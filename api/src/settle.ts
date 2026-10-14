// settleDay — the server-authoritative reconciliation core (private spec
// §0.10, §4). After every authorized state-changing write for an
// accountability date D, call:
//
//   rebuildDayWindow(fromDate = D, toDate = todayWib)
//
// The rebuild is a PURE FUNCTION of the entity tables (the source of truth):
//   1. day_log rows are recomputed date-by-date from meals/meal_rows, sleep,
//      workouts/exercise_sets — day_log is a recompute-from-scratch
//      projection, never the audit log
//   2. the streak chain is walked over the window, seeded from
//      (current_streak, streak_last_date) in rank_state
//   3. rank_state is upserted DETERMINISTICALLY from day_log aggregates:
//      lifetime (all-history points sum), season score (50% carryover from
//      the previous season + current-season points), longest streak
//
// Nothing here accumulates incrementally, so running the same window twice
// — or overlapping windows — converges to the same state. Deletes,
// backfills and REST-replace are handled correctly for free.

import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import {
  calendar,
  points as pointsLib,
  season as seasonLib,
} from '@chudlog/shared';

export type TrackerKey = 'food' | 'sleep' | 'gym';

const TZ = calendar.PRIVATE_TZ; // private v1: pinned WIB for every user

export type DbLike = Database.Database;

// --------------------------------------------------------------------------
// Readers (entity tables = source of truth)
// --------------------------------------------------------------------------

function countFoodRows(db: DbLike, userId: string, date: string): number {
  const r = db
    .prepare(
      `SELECT COUNT(*) AS n FROM meal_rows mr JOIN meals m ON m.id = mr.meal_id
       WHERE m.user_id = ? AND m.date = ?`,
    )
    .get(userId, date) as { n: number };
  return r.n;
}

function hasSleep(db: DbLike, userId: string, date: string): boolean {
  return Boolean(
    db.prepare('SELECT 1 AS x FROM sleep WHERE user_id = ? AND date = ? LIMIT 1').get(userId, date),
  );
}

function gymOutcome(db: DbLike, userId: string, date: string): 'workout' | 'rest' | null {
  const r = db
    .prepare('SELECT kind FROM workouts WHERE user_id = ? AND date = ?')
    .get(userId, date) as { kind: string } | undefined;
  return (r?.kind as 'workout' | 'rest' | null) ?? null;
}

function hasQualifyingWorkout(db: DbLike, userId: string, date: string): boolean {
  const r = db
    .prepare(
      `SELECT COUNT(*) AS n FROM exercise_sets es
       JOIN workouts w ON w.id = es.workout_id
       WHERE w.user_id = ? AND w.date = ? AND w.kind = 'workout'
         AND es.is_working = 1 AND COALESCE(es.reps, 0) >= 1`,
    )
    .get(userId, date) as { n: number };
  return r.n >= 1;
}

/**
 * A day counts as REAL (lit for compliance + points) only when every logged
 * entity for it was submitted strictly before that day's deadline (midnight
 * WIB). Late backfills stay visible as records but can never manufacture an
 * on-time lit day.
 */
function dayWasOnTime(db: DbLike, userId: string, date: string): boolean {
  const deadline = calendar.dayDeadline(date, TZ);
  const meal = db
    .prepare(
      `SELECT MAX(m.submitted_at) AS ts, COUNT(*) AS n
       FROM meals m JOIN meal_rows r ON r.meal_id = m.id
       WHERE m.user_id = ? AND m.date = ?`,
    )
    .get(userId, date) as { ts: number | null; n: number };
  if (meal.n > 0 && meal.ts !== null && meal.ts >= deadline) return false;

  const sleep = db
    .prepare('SELECT submitted_at AS ts FROM sleep WHERE user_id = ? AND date = ?')
    .get(userId, date) as { ts: number } | undefined;
  if (sleep && sleep.ts >= deadline) return false;

  const gym = db
    .prepare('SELECT submitted_at AS ts FROM workouts WHERE user_id = ? AND date = ?')
    .get(userId, date) as { ts: number } | undefined;
  if (gym && gym.ts >= deadline) return false;

  return true;
}

// --------------------------------------------------------------------------
// The rebuild
// --------------------------------------------------------------------------

export interface SettleOpts {
  /** Earliest affected accountability date ('YYYY-MM-DD', WIB). */
  fromDate: string;
  /** Rebuild through this date inclusive (usually today WIB). */
  toDate: string;
  /** Server now (UTC ms), for last_activity_ts; never trusted for dates. */
  nowMs?: number | undefined;
}

/** Local today ('YYYY-MM-DD', WIB) at `nowMs`. */
export function todayWib(nowMs?: number | undefined): string {
  return calendar.calendarDate(nowMs ?? Date.now(), TZ);
}

/** The canonical per-user settle: rebuild from the changed date to today. */
export function settleUserFrom(db: DbLike, userId: string, fromDate: string, nowMs?: number | undefined): void {
  rebuildDayWindow(db, userId, { fromDate, toDate: todayWib(nowMs), nowMs });
}

/**
 * Recompute day_log + rank_state for [fromDate, toDate] (contiguous WIB
 * dates, ≤400). One transaction. Deterministic and idempotent.
 */
export function rebuildDayWindow(db: DbLike, userId: string, opts: SettleOpts): void {
  const { fromDate, toDate } = opts;
  const nowMs = opts.nowMs ?? Date.now();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    throw new Error('settle: bad date');
  }
  if (fromDate > toDate) return;

  // --- baseline: the streak chain BEFORE this window -----------------------
  const prev = db
    .prepare(
      `SELECT current_streak, longest_streak, streak_last_date
       FROM rank_state WHERE user_id = ?`,
    )
    .get(userId) as
    | { current_streak: number; longest_streak: number; streak_last_date: string | null }
    | undefined;

  const prevStreak = prev?.current_streak ?? 0;
  const chainAlive =
    prev !== undefined &&
    prevStreak > 0 &&
    prev.streak_last_date !== null &&
    // chain continues only if its last lit day is exactly the day before the window
    calendar.shiftLocalDate(prev.streak_last_date, 1, TZ) === fromDate;

  const upsertDay = db.prepare(
    `INSERT INTO day_log (user_id, date, calendar_tz, food, sleep, gym, lit, restore_used, points_earned)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT (user_id, date) DO UPDATE SET
       food = excluded.food,
       sleep = excluded.sleep,
       gym = excluded.gym,
       lit = excluded.lit,
       points_earned = excluded.points_earned`,
  );

  let streak = chainAlive ? prevStreak : 0;
  let windowMax = 0;
  let lastLitDate: string | null = chainAlive ? (prev?.streak_last_date ?? null) : null;

  db.exec('BEGIN IMMEDIATE');
  try {
    let d = fromDate;
    let guard = 0;
    while (d <= toDate && guard < 400) {
      guard++;
      const food = countFoodRows(db, userId, d) >= 1 ? 1 : 0;
      const sleep = hasSleep(db, userId, d) ? 1 : 0;
      const outcome = gymOutcome(db, userId, d);
      const gym = outcome ? 1 : 0;
      const lit = food === 1 && sleep === 1 && gym === 1;
      const realLit = lit && dayWasOnTime(db, userId, d);

      // Points: qualifying workouts only, one award per date.
      // Real lit day → streak-bucket (10/20/30/50); attempted day → base 10.
      let pts = 0;
      if (outcome === 'workout' && hasQualifyingWorkout(db, userId, d)) {
        if (realLit) {
          streak += 1;
          lastLitDate = d;
          windowMax = Math.max(windowMax, streak);
          pts = pointsLib.pointsForWorkoutDay({
            hasQualifyingWorkout: true,
            dayIsLit: true,
            streakAfter: streak,
            alreadyEarnedToday: false,
          });
        } else {
          pts = pointsLib.pointsForWorkoutDay({
            hasQualifyingWorkout: true,
            dayIsLit: false,
            streakAfter: 0,
            alreadyEarnedToday: false,
          });
        }
      }
      if (!realLit) streak = 0; // a dark day breaks the chain

      upsertDay.run(userId, d, TZ, food, sleep, gym, lit ? 1 : 0, pts);
      d = calendar.shiftLocalDate(d, 1, TZ);
    }
    if (d <= toDate) throw new Error('settle: window exceeded 400 days');

    // --- rank_state: deterministic function of day_log ---------------------
    const lifetimePts = (
      db
        .prepare(`SELECT COALESCE(SUM(points_earned), 0) AS s FROM day_log WHERE user_id = ?`)
        .get(userId) as { s: number }
    ).s;

    const curSeason = seasonLib.seasonId(toDate);
    const [y, q] = [Number(curSeason.slice(0, 4)), Number(curSeason.slice(6))];
    const seasonStart = `${y}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`;
    const seasonPts = (
      db
        .prepare(
          `SELECT COALESCE(SUM(points_earned), 0) AS s
           FROM day_log WHERE user_id = ? AND date >= ? AND date <= ?`,
        )
        .get(userId, seasonStart, toDate) as { s: number }
    ).s;
    const earliestLog = (
      db.prepare(`SELECT MIN(date) AS m FROM day_log WHERE user_id = ?`).get(userId) as {
        m: string | null;
      }
    ).m;
    // carryover only when the user has history before this season began
    const carryover =
      earliestLog !== null && earliestLog < seasonStart
        ? seasonLib.seasonCarryover(sumSeasonPoints(db, userId, prevSeasonId(curSeason)))
        : 0;

    const seasonScore = carryover + seasonPts;
    const longest = Math.max(prev?.longest_streak ?? 0, windowMax);

    db.prepare(
      `INSERT INTO rank_state (user_id, current_streak, longest_streak, lifetime_points,
                               lifetime_tier, season_id, season_points, season_tier,
                               streak_last_date, last_activity_ts)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id) DO UPDATE SET
         current_streak = excluded.current_streak,
         longest_streak = excluded.longest_streak,
         lifetime_points = excluded.lifetime_points,
         lifetime_tier = excluded.lifetime_tier,
         season_id = excluded.season_id,
         season_points = excluded.season_points,
         season_tier = excluded.season_tier,
         streak_last_date = COALESCE(excluded.streak_last_date, rank_state.streak_last_date),
         last_activity_ts = excluded.last_activity_ts`,
    ).run(
      userId,
      streak,
      longest,
      lifetimePts,
      pointsLib.tierFor(lifetimePts),
      curSeason,
      seasonScore,
      pointsLib.tierFor(seasonScore),
      lastLitDate,
      nowMs,
    );

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

function prevSeasonId(seasonIdStr: string): string {
  const y = Number(seasonIdStr.slice(0, 4));
  const q = Number(seasonIdStr.slice(6));
  return q === 1 ? `${y - 1}-Q4` : `${y}-Q${q - 1}`;
}

function sumSeasonPoints(db: DbLike, userId: string, seasonIdStr: string): number {
  const y = Number(seasonIdStr.slice(0, 4));
  const q = Number(seasonIdStr.slice(6));
  const startMo = (q - 1) * 3 + 1;
  const endMo = startMo + 2;
  const start = `${y}-${String(startMo).padStart(2, '0')}-01`;
  const end = `${y}-${String(endMo).padStart(2, '0')}-31`;
  return (
    db
      .prepare(
        `SELECT COALESCE(SUM(points_earned), 0) AS s
         FROM day_log WHERE user_id = ? AND date >= ? AND date <= ?`,
      )
      .get(userId, start, end) as { s: number }
  ).s;
}

// --------------------------------------------------------------------------
// Audit (log_events — append-only, server-authored)
// --------------------------------------------------------------------------

export function appendLogEvent(
  db: DbLike,
  params: {
    userId: string;
    entityType: string;
    entityId: string;
    action:
      | 'create'
      | 'update'
      | 'delete'
      | 'rest-replace'
      | 'import'
      | 'restore'
      | 'admin-correction';
    date: string;
    idempotencyKey?: string;
    occurredAt?: number;
  },
): void {
  const nowMs = params.occurredAt ?? Date.now();
  db.prepare(
    `INSERT OR IGNORE INTO log_events
       (id, user_id, entity_type, entity_id, action, occurred_at, date, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    params.userId,
    params.entityType,
    params.entityId,
    params.action,
    nowMs,
    params.date,
    params.idempotencyKey ?? null,
  );
}

/** True if this (user, key) already produced an event → replay detected. */
export function hasEventId(db: DbLike, userId: string, idempotencyKey: string): boolean {
  return Boolean(
    db
      .prepare('SELECT 1 AS x FROM log_events WHERE user_id = ? AND idempotency_key = ? LIMIT 1')
      .get(userId, idempotencyKey),
  );
}

// --------------------------------------------------------------------------
// Push fan-out plumbing (durable per-endpoint jobs land with the nudge
// engine — week 3)
// --------------------------------------------------------------------------

export interface PushTarget {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export function listPushTargets(db: DbLike): PushTarget[] {
  const rows = db
    .prepare('SELECT user_id, endpoint, p256dh, auth FROM push_subs')
    .all() as Array<{ user_id: string; endpoint: string; p256dh: string; auth: string }>;
  return rows.map((r) => ({
    userId: r.user_id,
    endpoint: r.endpoint,
    p256dh: r.p256dh,
    auth: r.auth,
  }));
}

export function removePushSub(db: DbLike, endpoint: string): void {
  db.prepare('DELETE FROM push_subs WHERE endpoint = ?').run(endpoint);
  db.prepare('DELETE FROM nudge_deliveries WHERE endpoint = ?').run(endpoint);
}

/**
 * Stable notification tag: coalesces one nudge per user/date/hour on the
 * client (replaces hourly notifications within the same hour).
 */
export function pushTag(userId: string, date: string, hour: number): string {
  return [userId, date, String(hour)].join(':');
}
