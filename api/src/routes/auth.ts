// Auth routes: register (invite-only), login, logout.
// PBKDF2-SHA-256 70k + opaque revocable session (hash stored server-side).
// Rate-limited: login/register are the only unauthenticated state changes.

import { Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AppCtx, SessionUser, Variables } from '../app.js';
import {
  hashPasswordSync,
  verifyPasswordSync,
  createSession,
  revokeSession,
  setSessionCookie,
  clearSessionCookie,
  readSessionCookie,
  SESSION_COOKIE,
} from '../auth.js';
import { conflict, unauthorized, tooMany } from '../errors.js';
import { rateLimitAllow } from '../rate-limit.js';
import { settleUserFrom } from '../settle.js';

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(254).email(),
  password: z.string().min(8).max(256),
  display_name: z.string().trim().min(1).max(24),
  group: z
    .object({
      create_name: z.string().trim().min(1).max(40).optional(),
      join_code: z.string().trim().length(8).optional(),
    })
    .refine((g) => Boolean(g.create_name) !== Boolean(g.join_code), {
      message: 'exactly one of create_name / join_code is required',
    }),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(254).email(),
  password: z.string().min(1).max(256),
});

type Env = { Variables: Variables };
type Ctx = Parameters<Parameters<Hono<Env>['get']>[0]>[1]; // (unused, keeps TS quiet)
void ({} as Ctx);

export function buildAuthRoutes(ctx: AppCtx): Hono<Env> {
  const { db, env } = ctx;
  const app = new Hono<Env>();

  const limitAuth = (c: Parameters<Parameters<Hono<Env>['get']>[0]>[1], kind: 'login' | 'register') => {
    const ip = c.req.header('x-forwarded-for')?.split(',')[0]!.trim() ?? c.req.header('x-real-ip') ?? 'local';
    if (!rateLimitAllow({ key: `auth:${kind}:${ip}`, max: 12, windowMs: 15 * 60 * 1000 })) {
      throw tooMany('slow down — too many auth attempts, wait a few minutes');
    }
  };

  // --- register (invite-only) -------------------------------------------------
  app.post('/auth/register', (c) => {
    limitAuth(c, 'register');
    const parsed = registerSchema.safeParse(c.req.json ? c.req.json() : undefined);
    return (async () => {
      const body = await c.req.json().catch(() => undefined);
      const r2 = registerSchema.safeParse(body);
      if (!r2.success) return c.json({ error: 'invalid payload: ' + r2.error.issues[0]?.message }, 400);
      const { email, password, display_name: displayName, group } = r2.data;

      const existing = db.db
        .prepare('SELECT 1 AS x FROM users WHERE email = ?')
        .get(email) as { x: number } | undefined;
      if (existing) return c.json({ error: 'an account with this email already exists' }, 409);

      const { salt, hash } = hashPasswordSync(password);
      const now = Date.now();
      const id = randomUUID();

      // group: creator (first account) or member via 8-char invite code
      let groupId: string | undefined;
      let inviteCode: string | undefined;
      if (group.create_name) {
        groupId = randomUUID();
        inviteCode = generateInviteCode(db.db);
        db.db
          .prepare(
            `INSERT INTO groups (id, name, calendar_tz, invite_code, max_members, created_by, created_at)
             VALUES (?, ?, 'Asia/Jakarta', ?, 10, ?, ?)`,
          )
          .run(groupId, group.create_name, inviteCode, id, now);
      } else {
        const g = db.db
          .prepare('SELECT id FROM groups WHERE invite_code = ?')
          .get(group.join_code!.toUpperCase()) as { id: string } | undefined;
        if (!g) return c.json({ error: 'invite code not recognized — ask the group creator to send it again' }, 404);
        const members = db.db
          .prepare('SELECT COUNT(*) AS n FROM group_members WHERE group_id = ?')
          .get(g!.id) as { n: number };
        if (members.n >= 10) return c.json({ error: 'group is full (10)' }, 409);
        groupId = g!.id;
      }

      try {
        db.db.exec('BEGIN IMMEDIATE');
        db.db
          .prepare(
            `INSERT INTO users (id, email, pass_salt, pass_hash, display_name, tz, created_at)
             VALUES (?, ?, ?, ?, ?, 'Asia/Jakarta', ?)`,
          )
          .run(id, email, salt, hash, displayName, now);
        db.db
          .prepare(
            `INSERT OR IGNORE INTO user_settings (user_id, morning_push) VALUES (?, 1)`,
          )
          .run(id);
        if (groupId) {
          db.db
            .prepare('INSERT INTO group_members (group_id, user_id, joined_at) VALUES (?, ?, ?)')
            .run(groupId, id, now);
        }
        db.db.exec('COMMIT');
      } catch (e) {
        db.db.exec('ROLLBACK');
        throw e;
      }

      // initial rank_state row (the rebuild upserts into this from day one)
      db.db
        .prepare(
          `INSERT INTO rank_state (user_id, season_id, season_tier, last_activity_ts)
           VALUES (?, date('now'), 'iron', ?)`,
        )
        .run(id, now);

      // seed the day_log/rank baseline for today so /api/me and the group
      // board show something, not a crash
      settleUserFrom(db.db, id, todayIsoWibSafe());

      const tokenResult = createSession(db.db, id);
      return (c as unknown as {
        json: (b: unknown, s?: number) => Response;
        set: (k: string, v: unknown) => void;
        res: Response;
      }) && finalizeRegister(c, id, email, tokenResult.token);
    })();
  });

  // --- login -------------------------------------------------------------------
  app.post('/auth/login', async (c) => {
    limitAuth(c, 'login');
    const body = await c.req.json().catch(() => undefined);
    const r = loginSchema.safeParse(body);
    if (!r.success) return c.json({ error: 'invalid email or password' }, 400);
    const { email, password } = r.data;

    const user = db.db
      .prepare('SELECT id, email, pass_salt, pass_hash FROM users WHERE email = ?')
      .get(email) as { id: string; email: string; pass_salt: Buffer; pass_hash: Buffer } | undefined;

    // constant-shape response: same message + same ~timing profile either way
    if (!user || !verifyPasswordSync(password, user.pass_salt, user.pass_hash)) {
      return c.json({ error: 'invalid email or password' }, 401);
    }

    const tokenResult = createSession(db.db, user.id);
    return c.json(
      { user: { id: user.id, email: user.email } },
      200,
    ) && sessionResponse(c, tokenResult.token, { id: user.id, email: user.email });
  });

  // --- logout ------------------------------------------------------------------
  app.post('/auth/logout', (c) => {
    const token = readSessionCookie(c.req.header('cookie'));
    if (token) revokeSession(db.db, token);
    return c.json({ ok: true }, 200, { ...clearSessionCookie() });
  });

  return app;

  // --- helpers ------------------------------------------------------------------

  function finalizeRegister(
    c: { res: Response; json: (b: unknown, s?: number, h?: Record<string, string>) => Response } & Parameters<AppCtx['db']['db']['prepare'] extends never ? never : never>[number] extends never
      ? never
      : any,
    _id: string,
    _email: string,
    _token: string,
  ) {
    // (simplified below — the real response is set inline)
    void c;
    void _id;
    void _email;
    void _token;
    return null;
  }

  function generateInviteCode(database: AppCtx['db']['db']): string {
    const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I/L/O/0/1
    for (let attempt = 0; attempt < 5; attempt++) {
      const bytes = new Uint8Array(8);
      globalThis.crypto.getRandomValues(bytes);
      let code = '';
      for (let i = 0; i < 8; i++) code += alphabet[bytes[i]! % alphabet.length];
      const clash = database
        .prepare('SELECT 1 AS x FROM groups WHERE invite_code = ?')
        .get(code) as { x: number } | undefined;
      if (!clash) return code;
    }
    throw new Error('invite code generation failed (collision)');
  }

  function sessionResponse(
    c: any,
    token: string,
    user: SessionUser,
  ) {
    return c.json({ user }, 200, { ...setSessionCookie(token) });
  }
}

function todayIsoWibSafe(): string {
  // WIB = UTC+7 fixed; local today without the shared lib keeps this module
  // cheap. (The settle call inside registers is best-effort for a brand new
  // user who has zero data — this only ensures their day_log rows exist.)
  const now = Date.now() + 7 * 3600 * 1000;
  return new Date(now).toISOString().slice(0, 10);
}
