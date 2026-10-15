// "Both into this" (D101): which of the OTHER person's shown selections the
// viewer also has saved. Pure, no backend (unit checked). Exact intersection
// only — kind + source + canonical id (broad interests / activities: their
// fixed key). No title matching, no free text, no answers, no semantics;
// typed ("custom") entries never count, even with the same title.
import type { TasteItem } from '@/lib/onboardingV2/yourWorld';

export const SHARED_MAX = 2;
export const SHARED_LABEL = 'Both into this';

export type ShareableSelections = {
  interests: string[];
  activities?: string[];
  artists: TasteItem[];
  books: TasteItem[];
  screen: TasteItem[];
};

export const interestMarkKey = (key: string) => `interest:${key}`;
export const activityMarkKey = (key: string) => `activity:${key}`;
/** Catalog items only; typed entries have no canonical id → null. */
export const tasteMarkKey = (it: Pick<TasteItem, 'kind' | 'source' | 'id'>) =>
  it.source === 'custom' || !it.id ? null : `${it.kind}:${it.source}:${it.id}`;

const keysOf = (s: ShareableSelections) =>
  new Set<string>([
    ...s.interests.map(interestMarkKey),
    ...(s.activities ?? []).map(activityMarkKey),
    ...[...s.artists, ...s.books, ...s.screen].map(tasteMarkKey).filter((k): k is string => !!k),
  ]);

/**
 * Up to SHARED_MAX keys to mark on THEIR profile. Fixed priority: book,
 * movie/series, artist, activity, broad interest; within a kind their profile
 * order. A selection that is already the subject of one of their
 * conversation starters is skipped (the answer shows it). Deterministic.
 */
export function sharedHighlights(
  viewer: ShareableSelections,
  them: ShareableSelections,
  theirStarterSubjects: { kind: string; id: string }[] = [],
): string[] {
  const mine = keysOf(viewer);
  const inStarter = (kind: string, id: string) => theirStarterSubjects.some((t) => t.kind === kind && t.id === id);
  const ordered: (string | null)[] = [
    ...them.books.map((b) => (inStarter('book', b.id) ? null : tasteMarkKey(b))),
    ...them.screen.map((b) => (inStarter('screen', b.id) ? null : tasteMarkKey(b))),
    ...them.artists.map((b) => (inStarter('artist', b.id) ? null : tasteMarkKey(b))),
    ...(them.activities ?? []).map((k) => (inStarter('activity', k) ? null : activityMarkKey(k))),
    ...them.interests.map(interestMarkKey),
  ];
  const out: string[] = [];
  for (const k of ordered) {
    if (k && mine.has(k) && !out.includes(k)) out.push(k);
    if (out.length === SHARED_MAX) break;
  }
  return out;
}
