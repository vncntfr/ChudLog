import { t } from './i18n';

export type Tracker = 'food' | 'sleep' | 'gym';

export interface Me {
  user: {
    id: string;
    display_name: string;
    email: string;
    created_at: number;
    bodyweight_kg: number | null;
    protein_goal: number | null;
    calorie_goal: number | null;
    calorie_goal_mode?: string | null;
    sex?: string | null;
    age?: number | null;
    height_cm?: number | null;
    activity_factor?: number;
    bar_weight_kg?: number;
    plates_kg?: number[];
  };
  rank_state: {
    current_streak: number;
    longest_streak: number;
    lifetime_points: number;
    lifetime_tier: string;
    season_id: string;
    season_points: number;
  };
  today: Record<Tracker, number> & { points_earned: number };
  group: { id: string; name: string; invite_code: string };
}

export async function api(path: string, body?: unknown, method = 'POST') {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...(body === undefined ? {} : {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? t('error'));
  return data;
}
