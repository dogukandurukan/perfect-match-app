// Tempa onboarding V2 — Section 6 Your Dates (P06): approved copy (D57,
// docs/tempa/ONBOARDING_FLOW.md §6) and pure draft logic. Keys are local
// preview keys only; nothing here approves a backend schema, scoring, venue
// search or date scheduling. These are general first-date preferences — not
// availability, exact dates or a reservation.

export const YOUR_DATES_TOTAL_STEPS = 2;

export const DATES_SCREENS: { title: string; helper?: string }[] = [
  { title: 'Your ideal first date?', helper: 'Pick 1 or 2.' },
  { title: 'When are you free?', helper: 'For a first date.' },
];

export type DateIcon = { family: 'ion' | 'mci'; name: string };

// Two columns × three rows, row-major. Keys are the canonical `date_types`
// values of docs/tempa/SCHEMA_MAPPING.md (coffee, drinks, dinner, walk,
// activity, outdoors); only display copy changed ("A walk" = walk,
// "A fun activity" = activity, formerly "Something to do").
export const DATE_TYPES: { key: string; label: string; icon: DateIcon }[] = [
  { key: 'coffee', label: 'Coffee', icon: { family: 'ion', name: 'cafe-outline' } },
  { key: 'drinks', label: 'Drinks', icon: { family: 'ion', name: 'wine-outline' } },
  { key: 'dinner', label: 'Dinner', icon: { family: 'ion', name: 'restaurant-outline' } },
  { key: 'activity', label: 'A fun activity', icon: { family: 'ion', name: 'ticket-outline' } },
  { key: 'walk', label: 'A walk', icon: { family: 'ion', name: 'footsteps-outline' } },
  { key: 'outdoors', label: 'Outdoors', icon: { family: 'mci', name: 'terrain' } },
];

export const MIN_DATE_TYPES = 1;
export const MAX_DATE_TYPES = 2;

export const SPOT_TITLE = 'Have a favorite spot?';
export const SPOT_HELPER = 'For a first date. Optional.';
export const SPOT_PLACEHOLDER = 'Enter a place name';
/** Implementation bound for the optional free-text venue. */
export const SPOT_MAX_LENGTH = 120;

export type DaysKey = 'weekdays' | 'weekends' | 'either';
export type TimeKey = 'daytime' | 'evening' | 'either';

export const DAY_OPTIONS: { key: DaysKey; title: string; summary: string }[] = [
  { key: 'weekdays', title: 'Weekdays', summary: 'Weekdays' },
  { key: 'weekends', title: 'Weekends', summary: 'Weekends' },
  { key: 'either', title: 'Either', summary: 'Any day' },
];

export const TIME_OPTIONS: { key: TimeKey; title: string; summary: string }[] = [
  { key: 'daytime', title: 'Daytime', summary: 'Daytime' },
  { key: 'evening', title: 'Evening', summary: 'Evening' },
  { key: 'either', title: 'Either', summary: 'Any time' },
];

export const DAYS_GROUP_TITLE = 'Days';
export const TIME_GROUP_TITLE = 'Time';
export const SUMMARY_HELPER = 'Choose the exact time together.';

/**
 * Favorite spot as typed: custom, unverified text. No place ID, coordinates
 * or address are invented. A future provider-selected place would be a
 * separate variant, e.g. `{ source: 'google' | …; providerId; displayName;
 * branch/address }` — not implemented here.
 */
export type FavoriteSpot = { source: 'custom'; displayName: string };

export type DatesDraft = {
  dateTypes: string[];
  /** Raw field text, kept exactly as typed so Back/forward restores it. */
  spotText: string;
  days: DaysKey | null;
  time: TimeKey | null;
};

export const EMPTY_DATES_DRAFT: DatesDraft = {
  dateTypes: [],
  spotText: '',
  days: null,
  time: null,
};

/** Tapping a selected type deselects it; a third is refused, never replaces. */
export function toggleDateType(current: string[], key: string): string[] {
  if (current.includes(key)) return current.filter((k) => k !== key);
  if (current.length >= MAX_DATE_TYPES) return current;
  if (!DATE_TYPES.some((t) => t.key === key)) return current;
  return [...current, key];
}

/** Empty / whitespace-only → no venue. Spelling and case are kept; only the
 * surrounding whitespace is trimmed. */
export function favoriteSpot(d: DatesDraft): FavoriteSpot | null {
  const displayName = d.spotText.trim();
  return displayName ? { source: 'custom', displayName } : null;
}

/** Live summary, only once both groups are answered, e.g. "Weekends · Daytime". */
export function datesSummary(d: DatesDraft): string | null {
  const day = DAY_OPTIONS.find((o) => o.key === d.days);
  const time = TIME_OPTIONS.find((o) => o.key === d.time);
  if (!day || !time) return null;
  return `${day.summary} · ${time.summary}`;
}

/** step is 1-based within Your Dates. The favorite spot never counts toward
 * step 1 — only 1–2 date types do. */
export function isDatesStepValid(step: number, d: DatesDraft): boolean {
  if (step === 1) {
    const n = d.dateTypes.length;
    return (
      n >= MIN_DATE_TYPES &&
      n <= MAX_DATE_TYPES &&
      d.dateTypes.every((k) => DATE_TYPES.some((t) => t.key === k))
    );
  }
  if (step === 2) {
    return DAY_OPTIONS.some((o) => o.key === d.days) && TIME_OPTIONS.some((o) => o.key === d.time);
  }
  return false;
}
