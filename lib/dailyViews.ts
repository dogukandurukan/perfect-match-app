import { supabase } from '@/lib/supabaseClient';

export const DAILY_VIEW_LIMIT = 3;
const RESET_WINDOW_MS = 24 * 60 * 60 * 1000;

export type DailyViewsState = {
  count: number;
  resetAt: string;
  limitReached: boolean;
};

type DailyViewsRow = {
  daily_views_count: number | null;
  daily_views_reset_at: string | null;
};

function buildDailyViewsState(count: number, resetAt: string): DailyViewsState {
  return {
    count,
    resetAt,
    limitReached: count >= DAILY_VIEW_LIMIT,
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
    .select('daily_views_count, daily_views_reset_at')
    .eq('id', userId)
    .single();

  if (error || !data) {
    console.warn('[dailyViews] profiles fetch failed', error);
    return null;
  }

  const row = data as DailyViewsRow;
  const resetAt = row.daily_views_reset_at ?? new Date().toISOString();

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
    return buildDailyViewsState(refreshed.daily_views_count ?? 0, refreshed.daily_views_reset_at ?? now);
  }

  return buildDailyViewsState(row.daily_views_count ?? 0, resetAt);
}

export async function getDailyViewsState(userId: string): Promise<DailyViewsState | null> {
  return refreshDailyViewsIfNeeded(userId);
}

export async function incrementDailyViews(userId: string): Promise<DailyViewsState | null> {
  const current = await refreshDailyViewsIfNeeded(userId);
  if (!current) return null;

  const nextCount = current.count + 1;

  const { data, error } = await supabase
    .from('profiles')
    .update({ daily_views_count: nextCount })
    .eq('id', userId)
    .select('daily_views_count, daily_views_reset_at')
    .single();

  if (error || !data) {
    console.warn('[dailyViews] increment update failed', error);
    return null;
  }

  const row = data as DailyViewsRow;
  return buildDailyViewsState(
    row.daily_views_count ?? nextCount,
    row.daily_views_reset_at ?? current.resetAt,
  );
}

export function remainingDailyViews(state: DailyViewsState | null): number {
  if (!state) return DAILY_VIEW_LIMIT;
  return Math.max(0, DAILY_VIEW_LIMIT - state.count);
}
