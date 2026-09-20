import { supabase } from '@/lib/supabaseClient';

export const DAILY_VIEW_LIMIT = 5;
// Mirrors try_send_invite's existing free=1/premium=3 invite pattern
// (user request, 2026-09-10 — "premium olunca daha fazla hakkın olsun").
export const DAILY_VIEW_LIMIT_PREMIUM = 10;
const RESET_WINDOW_MS = 24 * 60 * 60 * 1000;

export function dailyViewLimitFor(isPremium: boolean): number {
  return isPremium ? DAILY_VIEW_LIMIT_PREMIUM : DAILY_VIEW_LIMIT;
}

export type DailyViewsState = {
  count: number;
  resetAt: string;
  limit: number;
  limitReached: boolean;
};

type DailyViewsRow = {
  daily_views_count: number | null;
  daily_views_reset_at: string | null;
  is_premium?: boolean | null;
};

function buildDailyViewsState(count: number, resetAt: string, limit: number): DailyViewsState {
  return {
    count,
    resetAt,
    limit,
    limitReached: count >= limit,
  };
}

export function msUntilReset(resetAt: string): number {
  const unlockAt = new Date(resetAt).getTime() + RESET_WINDOW_MS;
  return Math.max(0, unlockAt - Date.now());
}

export function formatDailyResetCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}s ${minutes}dk`;
  }
  if (minutes > 0) {
    return `${minutes}dk ${seconds}sn`;
  }
  return `${seconds}sn`;
}

// Row-locked, auth.uid()-checked server RPC (2026-09-21, Phase 0.1 —
// docs/phase-0-1-security-report.md) — this used to be a plain client
// `.select()` followed by a conditional client-side `.update({
// daily_views_count: 0, ... })` whenever a 24h-passed check computed in JS
// said a reset was due. Since that check ran entirely on the client, any
// authenticated user could PATCH those two columns directly at any time,
// resetting their own like-quota on demand — the whole point of
// `needsReset` was cosmetic, not enforced. `get_daily_views_state` now does
// the identical "reset if 24h has passed" decision server-side, inside the
// same row lock `increment_daily_views` already used, so a peek and an
// increment racing each other serialize correctly instead of one reading
// stale data.
export async function refreshDailyViewsIfNeeded(userId: string): Promise<DailyViewsState | null> {
  const { data, error } = await supabase.rpc('get_daily_views_state', { p_user: userId }).single();

  if (error || !data) {
    console.warn('[dailyViews] get_daily_views_state failed', error);
    return null;
  }

  const row = data as DailyViewsRow;
  const limit = dailyViewLimitFor(row.is_premium === true);
  return buildDailyViewsState(
    row.daily_views_count ?? 0,
    row.daily_views_reset_at ?? new Date().toISOString(),
    limit,
  );
}

export async function getDailyViewsState(userId: string): Promise<DailyViewsState | null> {
  return refreshDailyViewsIfNeeded(userId);
}

// Atomic — a row-locked Postgres RPC (mirrors try_send_invite's pattern),
// not a client-side read-then-write. Two near-simultaneous calls used to be
// able to read the same starting count and both write the same nextCount,
// under-counting and letting the daily limit be exceeded (found in codebase
// audit, 2026-08-31; migration 20260831090000). Also returns is_premium now
// (migration 20260910100000) so the free/premium cap is computed without an
// extra round-trip on every like.
export async function incrementDailyViews(userId: string): Promise<DailyViewsState | null> {
  const { data, error } = await supabase.rpc('increment_daily_views', { p_user: userId }).single();

  if (error || !data) {
    console.warn('[dailyViews] increment failed', error);
    return null;
  }

  const row = data as DailyViewsRow;
  return buildDailyViewsState(
    row.daily_views_count ?? 0,
    row.daily_views_reset_at ?? new Date().toISOString(),
    dailyViewLimitFor(row.is_premium === true),
  );
}

export function remainingDailyViews(state: DailyViewsState | null): number {
  if (!state) return DAILY_VIEW_LIMIT;
  return Math.max(0, state.limit - state.count);
}
