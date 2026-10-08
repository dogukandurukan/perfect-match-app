// Real V2 Discover data (perfect-match-dev / V2 backends): candidates in the
// existing server order, the public profile WITH stable content ids, the
// server like quota, and the one write path send_like_v2 (like + optional
// comment + quota in one server transaction). The pure decision helpers
// live in lib/discover/likeFlow.ts (unit checked, no backend).
import {
  realProfileFromServer,
  type Quota,
  type RealProfile,
  type SendResult,
  type ServerProfileWithIds,
} from '@/lib/discover/likeFlow';
import { parseTarget } from '@/lib/discover/profileLayout';
import { preloadProfilePhotoUrls, resolveProfilePhotoUrl } from '@/lib/resolveProfilePhotoUrl';
import { supabase } from '@/lib/supabaseClient';


/** Existing Discover order and eligibility (get_discovery_candidates_v2). */
export async function loadCandidateIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('get_discovery_candidates_v2', { p_limit: 20 });
  if (error) throw error;
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
}

/** null = no longer visible (blocked, hidden, deleted, not eligible). */
export async function loadRealProfile(userId: string): Promise<RealProfile | null> {
  const { data, error } = await supabase.rpc('get_profile_v2', { p_user: userId });
  if (error) throw error;
  if (!data) return null;
  const row = data as ServerProfileWithIds;
  const photos = row.photos ?? [];
  await preloadProfilePhotoUrls(photos.map((p) => p.path));
  const signed = new Map<string, string | null>();
  for (const p of photos) signed.set(p.path, await resolveProfilePhotoUrl(p.path));
  return realProfileFromServer(row, signed);
}

export async function loadQuota(): Promise<Quota | null> {
  const { data, error } = await supabase.rpc('get_my_like_quota_v2');
  if (error || !data) return null;
  return { remaining: Number(data.remaining ?? 0), limit: Number(data.limit ?? 0) };
}

/** source 'discover' uses the 5-argument call (the server records it as a
 * Discover like); 'daily_pick' adds p_source, which the server validates
 * against the caller's CURRENT daily pick. */
export async function sendLikeV2(
  likeeId: string,
  target: string,
  note: string | null,
  requestId: string,
  source: 'discover' | 'daily_pick' = 'discover',
): Promise<SendResult> {
  const t = parseTarget(target);
  if (!t) return { kind: 'refused', error: 'invalid_target', quota: null };
  try {
    const args: Record<string, unknown> = {
      p_likee: likeeId,
      p_target_type: t.type,
      p_target_id: t.id,
      p_note: note,
      p_request_id: requestId,
    };
    if (source === 'daily_pick') args.p_source = 'daily_pick';
    const { data, error } = await supabase.rpc('send_like_v2', args);
    if (error || !data) return { kind: 'unknown' };
    const quota = data.quota ? { remaining: Number(data.quota.remaining ?? 0), limit: Number(data.quota.limit ?? 0) } : null;
    if (data.ok === true) return { kind: 'ok', matched: data.matched === true, quota };
    return { kind: 'refused', error: String(data.error ?? 'unknown'), quota };
  } catch {
    return { kind: 'unknown' };
  }
}


export { likeOutcome, likesLeftText, requestIdFor } from '@/lib/discover/likeFlow';
export type { LikeOutcome, PendingAttempt, Quota, RealProfile, SendResult } from '@/lib/discover/likeFlow';
