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

function needsReset(resetAt: string): boolean {
  return new Date(resetAt).getTime() + RESET_WINDOW_MS < Date.now();
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

export async function refreshDailyViewsIfNeeded(userId: string): Promise<DailyViewsState | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('daily_views_count, daily_views_reset_at, is_premium')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.warn('[dailyViews] profiles fetch failed', error);
    return null;
  }

  const row = data as DailyViewsRow;
  const resetAt = row.daily_views_reset_at ?? new Date().toISOString();
  const limit = dailyViewLimitFor(row.is_premium === true);

  if (needsReset(resetAt)) {
    const now = new Date().toISOString();
    const { data: updated, error: updateError } = await supabase
      .from('profiles')
      .update({
        daily_views_count: 0,
        daily_views_reset_at: now,
      })
      .eq('id', userId)
      .select('daily_views_count, daily_views_reset_at')
      .single();

    if (updateError || !updated) {
      console.warn('[dailyViews] reset update failed', updateError);
      return null;
    }

    const refreshed = updated as DailyViewsRow;
    return buildDailyViewsState(
      refreshed.daily_views_count ?? 0,
      refreshed.daily_views_reset_at ?? now,
      limit,
    );
  }

  return buildDailyViewsState(row.daily_views_count ?? 0, resetAt, limit);
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
