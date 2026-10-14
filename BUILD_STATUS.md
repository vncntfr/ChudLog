# ChudLog — Build Status / Resume Point

**Last checkpoint:** 2026-10-14 (~08:45 WIB). Week 1 of 6 (private v1 build plan,
see Obsidian: `Important/Obsidian_Notes/Project/ChudLog/`).

## What is VERIFIED (real execution, not claims)

- `shared/` — DONE. 9 pure-rule modules (calendar/WIB, sleep, points, tdee,
  protein, e1rm, normalize, season, types).
- **48/48 boundary tests GREEN** (`npm --workspace shared run test`):
  - sleep window edges (21:00 / 01:30 / 01:31 / 04:30 / 09:30 / 09:31, 7h / 10h / 6h59m / 10h01m)
  - WIB midnight cutoff exact (dayDeadline = 17:00 UTC), week start Monday 00:00 WIB
  - points: workout-only revision (REST=0, base 10 off-lit, 10/20/30/50 buckets, idempotent)
  - rank ladder monotonic; season carryover 50%; e1rm guards; normalize suggest-never-merge
- `better-sqlite3` + esbuild installed and verified working (native modules OK).
- npm workspaces resolve (`api`/`web`/`shared`); git initialized.

## What is WRITTEN but NOT YET VERIFIED

- `api/src/settle.ts` — REWRITTEN: idempotent rebuild (day_log from entity
  tables, streak chain seeded from `rank_state(streak_last_date)`, rank_state
  as a deterministic function of day_log sums, 50% season carryover, real
  deadline enforcement via `dayWasOnTime`). Needs a typecheck + a settle
  integration test to prove idempotence (run window twice → same state).
- `api/src/auth.ts` — fixed to better-sqlite3 types. PBKDF2 70k, opaque
  revocable sessions. Untested.
- `api/src/app.ts` — REWRITTEN: real auth middleware (session → user),
  CORS/CSRF origin checks, body limits, error handler, health + VAPID meta
  routes, PWA statics serving with SPA fallback, static traversal guard.
- `api/src/routes/auth.ts` — register/login/logout written. **KNOWN BUG:**
  register handler returns `null` at the end (the `finalizeRegister` stub)
  instead of `c.json({user}, 200, setSessionCookie)` — the session cookie is
  created but never sent. Login uses the helper correctly. Fix before E2E.
  Also: delete the `Ctx = Parameters<...>` typing hack (lines ~43-51) — it
  fails `tsc`.
- `api/src/migrations/0002_streak_chain.sql` — adds `rank_state.streak_last_date`.
- `api/src/env.ts` — final (publicOrigin, staticDir, CHANGE_ME guard).
- `api/src/errors.ts`, `api/src/rate-limit.ts` — small, sane, untested.
- `db.ts` (WAL, FK on, numbered transactional migrations), `push.ts`
  (web-push, 404/410 cleanup), `schemas.ts` (zod payloads), `vapid-keygen.ts`
  — from before, plausibly fine, never typechecked.

## What is MISSING (explicit)

- `api/src/index.ts` — server entrypoint (loadEnv → openDb → runMigrations →
  listen). Referenced by package.json `dev`/`start`. Write first on resume.
- `api/src/migrate-cli.ts` — referenced by `migrate` script.
- `api/src/routes/me.ts` — imported by app.ts, does not exist. GET/PUT
  `/api/me` with explicit DTO allowlist (never serialize pass_salt/pass_hash).
- `web/` — empty. Vite + React 19 + TS + Router + Zustand, PWA manifest,
  §9 design tokens (dark #0E1116 bg, #161B22 cards, #FF8A1F accent, 12px
  radius, system font stack), i18n wrapper from commit one. The taste-style
  pass (refactoring-ui / microinteractions / ux-heuristics already loaded)
  applies when this exists.
- `.github/workflows/ci.yml` — dir exists, empty. CI: shared tests + api
  typecheck + api tests + web build.
- README, docker compose (VPS topology), `.env` (local dev secret).

## Resume order (each = one verified step, commit after each)

1. Fix `routes/auth.ts` (register response bug + remove typing hack),
   write `routes/me.ts`, `index.ts`, `migrate-cli.ts`.
2. `tsc --noEmit` clean on api.
3. Settle integration test: register user via HTTP → log sleep (valid API
   will come in week 2 — test rebuild by seeding SQL directly) → run window
   twice → assert rank_state identical. Then full-day scenario → points/streak
   per spec.
4. `npm --workspaces run typecheck && npm test` all green.
5. Start api (tsx watch) + minimal `web/` vite hello serving / → E2E gate:
   register 2 accounts against the local server, cookie auth round-trip,
   data in the SQLite file.
6. CI workflow, README, `git push` (private repo already created on first
   push if not done).
7. Week 1 gate done → checkpoint.

## Invariants that must never drift (spec anchors)

- Points: workout-only, one award/day, multiplier only on REAL lit days.
- day_log = recomputable projection; log_events = append-only audit. Never
  mix them.
- WIB (Asia/Jakarta) pinned for private; server `submitted_at` is the
  timeliness authority; midnight WIB = deadline, 23:00 = last nudge.
- No pass hash/salt/session token in any response (DTO allowlists).
- Private repo `vncntfr/chudlog` (GitHub) holds all durable state.

## Decisions already made (do not re-litigate)

- Hosting: one paid VPS (Caddy + api container, SQLite volume). No Cloudflare.
- Push: `web-push` npm lib, VAPID P-256 (RFC 8292), no hand-rolled crypto.
- Sessions: opaque 256-bit token, stored as SHA-256 hash, revocable,
  `__Host-cl_session` cookie.
- PBKDF2-SHA-256 70k for private (owner choice); Argon2id later for public.
- UI: tasteful dark minimalism per §9 + refactoring-ui/microinteractions
  skill discipline (constrained scales, no color crutch, sub-100ms feedback).
