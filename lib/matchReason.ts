import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type ReasonIconName = ComponentProps<typeof Ionicons>['name'];

/**
 * `reasons` from `get_top_matches` are plain, already-written sentences from
 * a fixed, known set of templates (see the RPC's `reasons` CASE list) — not
 * a typed category, but the templates themselves ARE effectively the type,
 * so this matches by template (prefix/exact), never by guessing off an
 * arbitrary word inside the sentence. That distinction matters concretely:
 * matching any reason containing "love" to a music-note icon would be wrong
 * for e.g. "You both love Fitness & Gaming" — hobbies are unbounded free
 * text from the algorithm, so shared-interest reasons always get one
 * consistent generic icon regardless of which hobby it is.
 *
 * 2026-09-18: extracted from components/home/WhyYouMatchCard.tsx (its only
 * consumer before today) into a shared lib file so components/matches/ can
 * reuse the exact same real-reason mapping instead of a second, drifting
 * copy — behavior is byte-for-byte identical to before the move.
 */
export function reasonIcon(reason: string): ReasonIconName {
  if (reason === 'Looking for the same thing' || reason.startsWith('Same relationship intention'))
    return 'heart-outline';
  if (reason.startsWith('You both love ')) return 'link-outline'; // shared interests, any topic
  if (reason === 'Nearby') return 'location-outline';
  if (reason === 'Same favorite spot') return 'pin-outline';
  if (reason === 'Similar drinking habits') return 'wine-outline';
  if (reason === 'Similar smoking habits') return 'ban-outline';
  if (reason === 'Same idea of a first date') return 'cafe-outline';
  if (reason === 'Great zodiac match') return 'sparkles-outline';
  return 'sparkles-outline';
}

/**
 * The RPC's intent-match reason ("Looking for the same thing") doesn't say
 * WHAT'S the same — reformats to a clearer but still honest generic line
 * instead of inventing/fetching the viewer's own intent (which not every
 * caller of this helper has loaded).
 */
export function reasonText(reason: string): string {
  if (reason === 'Looking for the same thing') return 'Same relationship intention';
  return reason;
}

/** The single strongest reason (RPC already orders `reasons` by priority), or null if none. */
export function strongestReason(reasons: string[] | null | undefined): string | null {
  const first = (reasons ?? []).find((r) => r.trim().length > 0);
  return first ? reasonText(first) : null;
}
