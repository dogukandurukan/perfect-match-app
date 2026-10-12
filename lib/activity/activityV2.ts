// Real V2 Activity: thin client over the server RPCs of
// supabase/proposed/20261012090000_v2_activity_accept.sql. Every rule
// (only the like's recipient may accept, one match per pair, retries return
// the same match, no quota, no message, block / unmatch / suspension) is
// enforced on the server; this file only calls it and shapes the result.
// Pure helpers live in lib/activity/feed.ts (re-exported here).
import { parseActivity, type AcceptResult, type ActivityData } from '@/lib/activity/feed';
import { supabase } from '@/lib/supabaseClient';

export * from '@/lib/activity/feed';

export type LoadResult =
  | { kind: 'ok'; value: ActivityData }
  /** The server doesn't have the Activity package (e.g. the shared DEV/live
   * project today) — the caller shows the previous Activity screen. */
  | { kind: 'unsupported' }
  | { kind: 'error'; message: string };

export const isMissingFunction = (e: { code?: string; message?: string } | null | undefined) =>
  !!e && (e.code === 'PGRST202' || /could not find the function/i.test(e.message ?? ''));

const LOAD_ERROR = 'Couldn’t load your activity. Check your connection and try again.';

export async function loadActivity(): Promise<LoadResult> {
  try {
    const { data, error } = await supabase.rpc('get_my_activity_v2');
    if (error) {
      if (isMissingFunction(error)) return { kind: 'unsupported' };
      console.warn('[Activity] get_my_activity_v2 failed', error.message);
      return { kind: 'error', message: LOAD_ERROR };
    }
    return { kind: 'ok', value: parseActivity(data) };
  } catch (e) {
    console.warn('[Activity] get_my_activity_v2 threw', e);
    return { kind: 'error', message: LOAD_ERROR };
  }
}

/** Marks ONE incoming like read (the profile was really opened). Never
 * accepts anything. Failures are logged and retried on the next open. */
export async function markLikeSeen(likeId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('mark_like_seen_v2', { p_like: likeId });
    if (error) console.warn('[Activity] mark_like_seen_v2 failed', error.message);
    return !error && data?.ok === true;
  } catch (e) {
    console.warn('[Activity] mark_like_seen_v2 threw', e);
    return false;
  }
}

/** "Match & chat": accepts the incoming like on the server. */
export async function acceptLike(likeId: string): Promise<AcceptResult> {
  try {
    const { data, error } = await supabase.rpc('accept_like_v2', { p_like: likeId });
    if (error || !data) {
      if (error) console.warn('[Activity] accept_like_v2 failed', error.message);
      return { kind: 'unknown' };
    }
    if (data.ok === true && data.match_id) {
      return { kind: 'ok', matchId: String(data.match_id), userId: String(data.user_id), replayed: data.replayed === true };
    }
    return { kind: 'refused', error: String(data.error ?? 'unknown') };
  } catch (e) {
    console.warn('[Activity] accept_like_v2 threw', e);
    return { kind: 'unknown' };
  }
}

