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

export type ReasonCompareProfile = {
  hobbies: string[] | null;
  intent: string | null;
  drinking: string | null;
  smoking: string | null;
  district: string | null;
  zodiac_sign: string | null;
  favorite_spots: Record<string, string> | null;
  meeting_environment: string[] | null;
};

// Same 12 traditional-opposite pairs `get_top_matches` uses for its
// "Great zodiac match" reason (only the top-3 tier — same element group
// alone does NOT trigger this reason in the RPC either, only score +2 not
// +5) — copied from `pg_get_functiondef('public.get_top_matches')`, not
// reconstructed from memory.
const ZODIAC_TOP3_PARTNERS: Record<string, string[]> = {
  Aries: ['Leo', 'Sagittarius', 'Libra'],
  Taurus: ['Virgo', 'Capricorn', 'Scorpio'],
  Gemini: ['Libra', 'Aquarius', 'Sagittarius'],
  Cancer: ['Scorpio', 'Pisces', 'Capricorn'],
  Leo: ['Aries', 'Sagittarius', 'Aquarius'],
  Virgo: ['Taurus', 'Capricorn', 'Pisces'],
  Libra: ['Gemini', 'Aquarius', 'Aries'],
  Scorpio: ['Cancer', 'Pisces', 'Taurus'],
  Sagittarius: ['Aries', 'Leo', 'Gemini'],
  Capricorn: ['Taurus', 'Virgo', 'Cancer'],
  Aquarius: ['Gemini', 'Libra', 'Leo'],
  Pisces: ['Cancer', 'Scorpio', 'Virgo'],
};

const TR_FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
function foldTr(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[çğıöşü]/g, (ch) => TR_FOLD[ch] ?? ch);
}

/**
 * Client-side mirror of `get_top_matches`'s own `reasons` CASE list — SAME
 * field comparisons, SAME templates (via reasonText/reasonIcon above), just
 * computed here instead of in SQL. This exists ONLY because the RPC itself
 * cannot be asked to (re)compute a reason for a pair that already has an
 * active `matches` row — its own WHERE clause unconditionally excludes any
 * candidate with an existing pending/accepted match from its results (found
 * live: calling get_top_matches for an account with existing pending
 * candidates returns a DIFFERENT person of the same first name instead —
 * confirmed via `pg_get_functiondef`, not assumed), so there is no way to
 * re-fetch a real RPC-computed reason for an existing pending candidate
 * without either changing the RPC or losing the specific person. This
 * mirrors the RPC's real logic instead of inventing a different one — used
 * ONLY as a fallback when the RPC's own `reasons` weren't captured at
 * backfill time (see matches.tsx's buildCardFromPending).
 *
 * Priority order matches this feature's own brief (hobby → intent →
 * lifestyle → other), which differs slightly from the RPC's own internal
 * ordering (intent → hobby → location → ...) — that's fine, this is a
 * separate, explicitly-requested priority for the fallback path only; a
 * freshly-backfilled candidate with a real RPC reason still displays in
 * the RPC's own order, unaffected by this function.
 */
export function computeFallbackReason(
  me: ReasonCompareProfile,
  them: ReasonCompareProfile,
): string | null {
  // 1. Shared hobbies — exact string match, same as the RPC's
  // `h = ANY(me.hobbies)` (hobbies come from a fixed, small dropdown list,
  // not free text, so exact equality is what the RPC itself relies on).
  const myHobbies = new Set(me.hobbies ?? []);
  const shared = (them.hobbies ?? []).filter((h) => myHobbies.has(h));
  if (shared.length >= 1) {
    return `You both love ${shared.slice(0, 2).join(' & ')}`;
  }

  // 2. Same relationship intention — exact match.
  if (me.intent && them.intent && me.intent === them.intent) {
    return reasonText('Looking for the same thing');
  }

  // 3. Lifestyle — exact drinking or smoking match (the RPC only fires
  // this reason at its EXACT-match score tier, not its partial-credit
  // tiers for adjacent values like Yes/Socially).
  if (me.drinking && them.drinking && me.drinking === them.drinking) {
    return 'Similar drinking habits';
  }
  if (me.smoking && them.smoking && me.smoking === them.smoking) {
    return 'Similar smoking habits';
  }

  // 4. Other real compatibility signals, in the RPC's own sub-order.
  if (me.district && them.district && me.district.trim().toLowerCase() === them.district.trim().toLowerCase()) {
    return 'Nearby';
  }
  const mySpots = Object.values(me.favorite_spots ?? {})
    .filter((v) => typeof v === 'string' && v.trim())
    .map(foldTr);
  const theirSpots = Object.values(them.favorite_spots ?? {})
    .filter((v) => typeof v === 'string' && v.trim())
    .map(foldTr);
  if (mySpots.some((s) => theirSpots.includes(s))) {
    return 'Same favorite spot';
  }
  const myEnv = new Set(me.meeting_environment ?? []);
  if ((them.meeting_environment ?? []).some((e) => myEnv.has(e))) {
    return 'Same idea of a first date';
  }
  if (me.zodiac_sign && them.zodiac_sign && (ZODIAC_TOP3_PARTNERS[me.zodiac_sign] ?? []).includes(them.zodiac_sign)) {
    return 'Great zodiac match';
  }

  return null;
}
