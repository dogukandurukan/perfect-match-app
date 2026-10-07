// Pure decision helpers for the real V2 Discover (no backend, no React
// Native): server row → Discover person, safe retry request ids, and what
// the screen does with each send_like_v2 result. Unit checked in
// scripts/onboarding-v2-checks/v2_discover_real.check.js.
import { type DiscoverPerson } from '@/lib/discover/profileLayout';
import { publicProfileFromServer, type ServerPublicProfile } from '@/lib/onboardingV2/serverMapping';
import { promptLabel } from '@/lib/onboardingV2/yourProfile';

export type ServerProfileWithIds = ServerPublicProfile & {
  photos?: { id: string; path: string }[] | null;
  prompts: { id?: string; slot: number; prompt_id: string; answer: string }[] | null;
};

export type RealProfile = { person: DiscoverPerson; photoUrls: string[] };
export type Quota = { remaining: number; limit: number };

/** Pure: server row + signed URLs → Discover person. Photos that could not be
 * signed are dropped together with their id (ids and images stay aligned). */
export function realProfileFromServer(row: ServerProfileWithIds, signed: Map<string, string | null>): RealProfile {
  const usable = (row.photos ?? []).filter((p) => !!signed.get(p.path));
  const base = publicProfileFromServer({ ...row, photo_paths: usable.map((p) => p.path) }, signed);
  const prompts = [...(row.prompts ?? [])]
    .sort((a, b) => a.slot - b.slot)
    .filter((r) => r.answer?.trim())
    .map((r) => ({ promptId: r.prompt_id, answer: r.answer, id: r.id }));
  const { photos: _photos, prompts: _prompts, ...rest } = base;
  return {
    person: {
      ...rest,
      id: row.user_id,
      // No explicit "show my district" choice exists yet and get_profile_v2
      // never returns a district: the hero shows the city.
      district: null,
      photoCount: usable.length,
      photoIds: usable.map((p) => p.id),
      prompts,
    },
    photoUrls: usable.map((p) => signed.get(p.path) as string),
  };
}

export type SendResult =
  | { kind: 'ok'; matched: boolean; quota: Quota | null }
  | { kind: 'refused'; error: string; quota: Quota | null }
  /** Network / unknown: the server may or may not have saved it. Retry with
   * the SAME request id — the server then returns the original result. */
  | { kind: 'unknown' };

// ─── Pure decision helpers (unit checked) ──────────────────────────────────

/** One pending attempt per person. A retry of the SAME content reuses the
 * request id (so an earlier attempt that actually succeeded is not doubled);
 * anything else gets a new id (the server's one-like-per-person rule then
 * refuses a second like). */
export type PendingAttempt = { likeeId: string; target: string; note: string; requestId: string };

export function requestIdFor(pending: PendingAttempt | null, likeeId: string, target: string, note: string, fresh: () => string): string {
  if (pending && pending.likeeId === likeeId && pending.target === target && pending.note === note) return pending.requestId;
  return fresh();
}

export type LikeOutcome = {
  /** Heart success: open the next person. */
  advance: boolean;
  /** Comment success: stay, show the sent note in place. */
  showSent: boolean;
  /** The person is done (liked / not available): Next profile instead of ×. */
  done: boolean;
  /** Keep the editor and its draft open (failure). */
  keepEditor: boolean;
  /** Keep the request id for a safe retry (result unknown). */
  keepPending: boolean;
  /** Re-read the profile (content changed). */
  reloadProfile: boolean;
  message: string | null;
};

export function likeOutcome(r: SendResult, withComment: boolean, name: string): LikeOutcome {
  const base: LikeOutcome = { advance: false, showSent: false, done: false, keepEditor: withComment, keepPending: false, reloadProfile: false, message: null };
  if (r.kind === 'ok') {
    return withComment ? { ...base, showSent: true, done: true, keepEditor: false } : { ...base, advance: true, keepEditor: false };
  }
  if (r.kind === 'unknown') {
    return { ...base, keepPending: true, message: 'Couldn’t send. Check your connection and try again.' };
  }
  switch (r.error) {
    case 'quota_exhausted':
      return { ...base, message: 'You’re out of likes.' };
    case 'already_liked':
      return { ...base, done: true, keepEditor: false, message: `You’ve already liked ${name}.` };
    case 'not_available':
      return { ...base, done: true, keepEditor: false, message: 'This profile isn’t available anymore.' };
    case 'invalid_target':
      return { ...base, reloadProfile: true, message: 'This photo or answer has changed. Please try again.' };
    case 'note_too_long':
      return { ...base, message: 'Your comment is too long.' };
    default:
      return { ...base, message: 'Couldn’t send. Please try again.' };
  }
}

export const likesLeftText = (q: Quota | null) => (q ? `${q.remaining} ${q.remaining === 1 ? 'like' : 'likes'} left` : '');

/** "Likes you" (receiver, premium only — rule unchanged): what the like was
 * on, from the server's id lookup. Removed / replaced content is never
 * presented as another photo or prompt. */
export function likedTargetText(r: {
  target_type: string | null;
  target_available: boolean | null;
  target_prompt_id: string | null;
}): string | null {
  if (r.target_type === 'photo') return r.target_available ? 'On your photo' : 'On a photo no longer on your profile';
  if (r.target_type === 'prompt') {
    if (!r.target_available || !r.target_prompt_id) return 'On an answer no longer on your profile';
    const label = promptLabel(r.target_prompt_id);
    return label ? `On your answer: ${label}` : 'On your answer';
  }
  return null;
}
