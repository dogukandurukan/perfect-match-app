// Activity copy + small pure helpers (D75–D80). Shared by the real V2
// Activity (components/activity/*, app/v2/activity-profile.tsx) and the DEV
// design preview (lib/dev/activityPreview.ts re-exports them), so the
// approved wording lives in one place. No backend imports.

export type InterestKind = 'profile' | 'photo' | 'prompt';

/** "Liked you" (whole profile) / "Liked your photo" / "Liked your answer". */
export function interestLabelFor(kind: InterestKind): string {
  return kind === 'profile' ? 'Liked you' : kind === 'photo' ? 'Liked your photo' : 'Liked your answer';
}
export const matchedLine = (name: string) => `You and ${name} matched`;

export function timeAgo(minutes: number): string {
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 60 * 48) return 'Yesterday';
  return `${Math.floor(minutes / (60 * 24))}d`;
}
export const timeAgoLong = (minutes: number) => (minutes < 1 ? 'Just now' : /^\d/.test(timeAgo(minutes)) ? `${timeAgo(minutes)} ago` : timeAgo(minutes));
export const matchedWhen = (minutes: number) => (minutes < 60 * 24 ? 'You matched today' : `You matched ${timeAgoLong(minutes).toLowerCase()}`);

/** Whole minutes since an ISO time (never negative; bad input → 0). */
export function minutesSince(iso: string | null | undefined, now: number = Date.now()): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 60000)) : 0;
}

export const MATCH_COPY = {
  cta: 'Match & chat',
  caption: (name: string) => `Match with ${name} and open your chat.`,
  open: 'Open chat',
  error: 'Couldn’t match right now. Check your connection and try again.',
  sendError: 'Message not sent. Check your connection and try again.',
  emptyTitle: 'Nothing new yet',
  emptyText: 'When someone likes you, you’ll see them here.',
  hello: (name: string) => `Say hello to ${name}`,
  helloText: 'Send a message whenever you like.',
  howItStarted: 'How it started',
} as const;
