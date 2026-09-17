import { supabase } from '@/lib/supabaseClient';

export const DAILY_INVITE_LIMIT_FREE = 1;
export const DAILY_INVITE_LIMIT_PREMIUM = 3;
const RESET_WINDOW_MS = 24 * 60 * 60 * 1000;

export type DailyInvitesState = {
  count: number;
  resetAt: string | null;
  limit: number;
  remaining: number;
  limitReached: boolean;
};

type DailyInvitesRow = {
  daily_invites_count: number | null;
  daily_invites_reset_at: string | null;
  is_premium: boolean | null;
};

function inviteLimit(isPremium: boolean): number {
  return isPremium ? DAILY_INVITE_LIMIT_PREMIUM : DAILY_INVITE_LIMIT_FREE;
}

function buildState(
  count: number,
  resetAt: string | null,
  isPremium: boolean,
): DailyInvitesState {
  const limit = inviteLimit(isPremium);
  return {
    count,
    resetAt,
    limit,
    remaining: Math.max(0, limit - count),
    limitReached: count >= limit,
  };
}

function needsReset(resetAt: string | null): boolean {
  if (!resetAt) return false;
  return new Date(resetAt).getTime() + RESET_WINDOW_MS < Date.now();
}

/**
 * Best-effort invite quota read. Returns null if columns are missing or fetch fails
 * (caller should hide the indicator and not block invites).
 *
 * Reads `is_premium` itself now instead of trusting a caller-supplied flag
 * (2026-09-18: found live — matches.tsx was calling this with a hardcoded
 * `false`, so a real premium account with `daily_invites_count=1` hit
 * `limitReached` against the FREE limit of 1 instead of premium's 3,
 * showing "You've used your invite for today" a full 2 invites early). The
 * optional `isPremiumOverride` param is kept only for a caller that already
 * has a known-fresher premium flag in hand and wants to skip the extra
 * column read — no current caller uses it.
 */
export async function getDailyInvitesState(
  userId: string,
  isPremiumOverride?: boolean,
): Promise<DailyInvitesState | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('daily_invites_count, daily_invites_reset_at, is_premium')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as DailyInvitesRow;
  const resetAt = row.daily_invites_reset_at ?? null;
  const count = typeof row.daily_invites_count === 'number' ? row.daily_invites_count : 0;
  const isPremium = isPremiumOverride ?? row.is_premium === true;

  if (needsReset(resetAt)) {
    return buildState(0, resetAt, isPremium);
  }

  return buildState(count, resetAt, isPremium);
}

export function remainingInvitesLabel(state: DailyInvitesState): string {
  const n = state.remaining;
  return `${n} ${n === 1 ? 'invite' : 'invites'} left today`;
}
