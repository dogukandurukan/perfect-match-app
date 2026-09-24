// Tempa onboarding V2 — Section 2 Basics: in-memory draft types, option sets
// and validation (P02). Pure functions only — no persistence, no backend.
import type { LocationResult } from '@/lib/onboardingV2/locationCatalog';
import { heightValue } from '@/lib/onboardingV2/heightRuler';
import { calculateAge } from '@/lib/zodiac';

export const BASICS_TOTAL_STEPS = 6;

// DECISIONS D15 / D15b — labels are approved; keys remain proposed.
export type Gender = 'woman' | 'man' | 'non_binary';
export const GENDER_OPTIONS: { key: Gender; label: string }[] = [
  { key: 'woman', label: 'Woman' },
  { key: 'man', label: 'Man' },
  { key: 'non_binary', label: 'Non-binary' },
];

export type InterestedIn = 'women' | 'men' | 'non_binary_people' | 'everyone';
export const INTERESTED_IN_OPTIONS: { key: InterestedIn; label: string }[] = [
  { key: 'women', label: 'Women' },
  { key: 'men', label: 'Men' },
  { key: 'non_binary_people', label: 'Non-binary people' },
  { key: 'everyone', label: 'Everyone' },
];

export type BasicsDraft = {
  firstName: string;
  lastName: string;
  dobDay: string;
  dobMonth: string;
  dobYear: string;
  gender: Gender | null;
  interestedIn: InterestedIn[];
  /** What the user typed in the location field. */
  locationQuery: string;
  /** The selected result (D49); cleared whenever the query is edited. */
  location: LocationResult | null;
  heightCm: string;
};

export const EMPTY_BASICS_DRAFT: BasicsDraft = {
  firstName: '',
  lastName: '',
  dobDay: '',
  dobMonth: '',
  dobYear: '',
  gender: null,
  interestedIn: [],
  locationQuery: '',
  location: null,
  heightCm: '',
};

/** Everyone is exclusive: picking it clears specific choices; picking a
 * specific choice clears Everyone. Tapping a selected option deselects it. */
export function toggleInterestedIn(current: InterestedIn[], key: InterestedIn): InterestedIn[] {
  if (current.includes(key)) return current.filter((k) => k !== key);
  if (key === 'everyone') return ['everyone'];
  return [...current.filter((k) => k !== 'everyone'), key];
}

// Age eligibility reused from existing app policy, not invented here:
// - minimum 18: app/privacy-notice.tsx ("yalnızca 18 yaşını doldurmuş
//   kullanıcılara yöneliktir"); discovery_age_min CHECK >= 18.
// - maximum 120: legacy app/profile-setup/step1/birthdate.tsx upper bound.
// (The legacy screen's lower bound of 13 contradicts the privacy notice and is
// NOT reused — reported in P02_RESULT.md.)
export const MIN_AGE = 18;
export const MAX_AGE = 120;

export type DobResult =
  | { ok: true; date: Date; age: number }
  | { ok: false; reason: 'incomplete' | 'invalid' | 'future' | 'too_young' | 'too_old' };

export function parseDob(day: string, month: string, year: string, now: Date = new Date()): DobResult {
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) {
    return { ok: false, reason: 'incomplete' };
  }
  const d = Number(day);
  const m = Number(month);
  const y = Number(year);
  const date = new Date(y, m - 1, d);
  // Rejects impossible dates such as 31/02 (JS would roll them over).
  if (m < 1 || m > 12 || d < 1 || date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return { ok: false, reason: 'invalid' };
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date > today) return { ok: false, reason: 'future' };
  const age = calculateAge(date);
  if (age < MIN_AGE) return { ok: false, reason: 'too_young' };
  if (age > MAX_AGE) return { ok: false, reason: 'too_old' };
  return { ok: true, date, age };
}

export function dobErrorMessage(reason: Exclude<DobResult, { ok: true }>['reason']): string | null {
  switch (reason) {
    case 'incomplete':
      return null; // no error while still typing
    case 'invalid':
      return "That date doesn't exist. Check the day and month.";
    case 'future':
      return "Your birthday can't be in the future.";
    case 'too_young':
      return `You need to be at least ${MIN_AGE} to use Tempa.`;
    case 'too_old':
      return 'Please check the year.';
  }
}

// Height: required (D12). No product bounds exist in the repo (legacy only
// requires a positive integer; 140–220 in filters.tsx is a discovery filter
// range, not an input rule), so only "positive whole number" is enforced.
export function parseHeightCm(v: string): number | null {
  return heightValue(v);
}

/** Editing the location text always invalidates a previous selection (D49). */
export function editLocationQuery(d: BasicsDraft, text: string): Partial<BasicsDraft> {
  return { locationQuery: text, location: null };
}

/** Selecting a suggestion fills the field with its label. */
export function selectLocation(d: BasicsDraft, r: LocationResult): Partial<BasicsDraft> {
  return { location: r, locationQuery: r.label };
}

export function isStepValid(step: number, d: BasicsDraft): boolean {
  switch (step) {
    case 1:
      return d.firstName.trim().length > 0 && d.lastName.trim().length > 0;
    case 2:
      return parseDob(d.dobDay, d.dobMonth, d.dobYear).ok;
    case 3:
      return d.gender !== null;
    case 4:
      return d.interestedIn.length > 0;
    case 5:
      return d.location !== null;
    case 6:
      return parseHeightCm(d.heightCm) !== null;
    default:
      return false;
  }
}
