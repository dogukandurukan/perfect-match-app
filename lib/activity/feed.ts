// Pure Activity helpers (no backend import — unit checked in
// scripts/onboarding-v2-checks/v2_activity_real.check.js): server JSON →
// data, the one-person-once feed, and the Match & chat error text.
import type { MyMatch } from '@/lib/matchChatV2';

export type ActivityInterest = {
  like_id: string;
  user_id: string;
  first_name: string | null;
  age: number | null;
  city: string | null;
  photo_path: string | null;
  target_type: 'profile' | 'photo' | 'prompt';
  note: string | null;
  created_at: string;
  seen: boolean;
  /** My liked photo / answer (null when it was removed since). */
  target_photo_path: string | null;
  target_prompt_id: string | null;
  target_answer: string | null;
};

export type ActivityData = {
  member: boolean;
  premium: boolean;
  /** Pending incoming likes (also counted when identities are locked). */
  pendingCount: number;
  pending: ActivityInterest[];
  matches: MyMatch[];
};

/** Pure: server JSON → ActivityData (defensive about missing fields). */
export function parseActivity(raw: unknown): ActivityData {
  const d = (raw ?? {}) as Record<string, unknown>;
  const pending = Array.isArray(d.pending) ? (d.pending as ActivityInterest[]) : [];
  const matches = Array.isArray(d.matches) ? (d.matches as MyMatch[]) : [];
  return {
    member: d.member === true,
    premium: d.premium === true,
    pendingCount: Number(d.pending_count ?? pending.length) || 0,
    pending: pending.map((p) => ({ ...p, note: p.note?.trim() ? p.note.trim() : null, seen: p.seen === true })),
    matches,
  };
}

export type AcceptResult =
  | { kind: 'ok'; matchId: string; userId: string; replayed: boolean }
  /** The server answered no (not available any more, not yours…). */
  | { kind: 'refused'; error: string }
  /** No answer (network / timeout): nothing may look matched; a retry with
   * the same like id is safe — the server returns the same match. */
  | { kind: 'unknown' };

export function acceptErrorText(r: AcceptResult, name: string): string | null {
  if (r.kind === 'ok') return null;
  if (r.kind === 'refused' && (r.error === 'not_available' || r.error === 'not_found')) return `${name} isn’t available anymore.`;
  if (r.kind === 'refused' && r.error === 'not_member') return 'Your account can’t match right now.';
  return 'Couldn’t match right now. Check your connection and try again.';
}

// ── Pure feed ─────────────────────────────────────────────────────────────

export type ActivityFeedItem =
  | { kind: 'interest'; key: string; at: string; interest: ActivityInterest }
  | { kind: 'match'; key: string; at: string; match: MyMatch };

/** One vertical feed, newest first. A person appears once: if they are in
 * the matches, any pending card for them is dropped (match row wins). */
export function buildActivityFeed(d: Pick<ActivityData, 'pending' | 'matches'>): ActivityFeedItem[] {
  const matched = new Set(d.matches.map((m) => m.other_id));
  const seenPeople = new Set<string>();
  const interests: ActivityFeedItem[] = [];
  for (const p of d.pending) {
    if (matched.has(p.user_id) || seenPeople.has(p.user_id)) continue;
    seenPeople.add(p.user_id);
    interests.push({ kind: 'interest', key: `i-${p.like_id}`, at: p.created_at, interest: p });
  }
  const rows: ActivityFeedItem[] = d.matches.map((m) => ({ kind: 'match', key: `m-${m.match_id}`, at: m.last_message_at ?? m.matched_at, match: m }));
  return [...interests, ...rows].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Pure: a match row's second line ("Conversation started" only after a
 * real stored message). */
export const conversationStarted = (m: Pick<MyMatch, 'last_message'>) => m.last_message !== null && m.last_message !== undefined;

/**
 * Activity tab badge: incoming likes still pending (server rules) that the
 * user can see — the premium list (D84) — and hasn't opened yet. Without
 * premium the identities are hidden and none can be opened, so the badge
 * stays 0 (the in-Activity "N people like you" teaser is unchanged).
 */
export function unseenLikeCount(d: Pick<ActivityData, 'premium' | 'pending' | 'matches'>): number {
  if (!d.premium) return 0;
  const matched = new Set(d.matches.map((m) => m.other_id));
  const people = new Set<string>();
  for (const p of d.pending) if (!p.seen && !matched.has(p.user_id)) people.add(p.user_id);
  return people.size;
}
