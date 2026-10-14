// Small env loader — no dotenv dependency. Reads CWD .env if present;
// process.env always wins. Values are trimmed; empty values become undefined.

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function parseEnvFile(text: string): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key && val !== '') out[key] = val;
  }
  return out;
}

export interface ChudEnv {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  host: string;
  dbPath: string;
  sessionSecret: string;
  allowedOrigins: string[]; // explicit origins (dev vite :5173, public origin). Empty ⇒ same-origin strict.
  publicOrigin: string; // origin the app is published under (also CORS/CSRF-allowed)
  vapidPublicKey: string; // Base64URL — safe to expose to the frontend
  vapidPrivateKeyJwk: string; // server-side only
  vapidAdminEmail: string;
  vapidSub: string;
  adminEmails: Set<string>;
  /** Directory of built PWA statics to serve alongside the API (optional). */
  staticDir: string;
}

export function loadEnv(cwd = process.cwd()): ChudEnv {
  let file: Record<string, string | undefined> = {};
  const p = resolve(cwd, '.env');
  if (existsSync(p)) file = parseEnvFile(readFileSync(p, 'utf8'));
  const v = (k: string): string | undefined => process.env[k] ?? file[k];

  const nodeEnv = (v('NODE_ENV') ?? 'development') as ChudEnv['nodeEnv'];
  if (!['development', 'test', 'production'].includes(nodeEnv)) throw new Error(`bad NODE_ENV: ${nodeEnv}`);

  const sessionSecret = v('SESSION_SECRET') ?? '';
  if (nodeEnv === 'production') {
    if (Buffer.byteLength(sessionSecret, 'utf8') < 32) throw new Error('SESSION_SECRET must be >= 32 bytes in production');
  } else if (!sessionSecret || sessionSecret === 'CHANGE_ME') {
    throw new Error('SESSION_SECRET is required (copy .env.example to .env and set a real value)');
  }

  const origins = (v('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

  return {
    nodeEnv,
    port: Number(v('PORT') ?? 8787),
    host: v('HOST') ?? '127.0.0.1',
    dbPath: v('DB_PATH') ?? './data/chudlog.db',
    sessionSecret,
    allowedOrigins: origins,
    publicOrigin: (v('PUBLIC_ORIGIN') ?? `http://${v('HOST') ?? '127.0.0.1'}:${v('PORT') ?? 8787}`).replace(/\/$/, ''),
    vapidPublicKey: v('VAPID_PUBLIC_KEY') ?? '',
    vapidPrivateKeyJwk: v('VAPID_PRIVATE_KEY') ?? '',
    vapidAdminEmail: v('VAPID_ADMIN_EMAIL') ?? 'admin@localhost',
    vapidSub: v('VAPID_SUB') ?? 'mailto:admin@localhost',
    adminEmails: new Set((v('ADMIN_EMAILS') ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)),
    staticDir: v('STATIC_DIR') ?? resolve(process.cwd(), '../web/dist'),
  };
}
