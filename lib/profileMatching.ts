// Screen: Profil / setup1 eşleşme alanları | Status: stable | Last updated: Mayıs 2026
/**
 * Setup-1 ↔ matching: gender ↔ meeting preferences, city, languages (hard),
 * plus district / age scoring. (No language bonus — overlap is only a hard filter.)
 */

import { ageDifferenceScore, absAgeGapYears } from './setup1Matching';

export { ageDifferenceScore, absAgeGapYears };

const GENDER_TO_MEETING_LABEL: Record<string, 'Men' | 'Women' | 'Non-binary'> = {
  Man: 'Men',
  Woman: 'Women',
  'Non-binary': 'Non-binary',
};

function normalizeLangList(l: string | string[] | null | undefined): string[] {
  const arr = typeof l === 'string' ? [l] : l ?? [];
  return [...new Set(arr.map((x) => x.trim().toLowerCase()).filter(Boolean))];
}

/** Map profile `gender` to meeting-preference chip (free-text → Non-binary bucket). */
function meetingLabelForGender(otherGender: string): 'Men' | 'Women' | 'Non-binary' | undefined {
  const label = GENDER_TO_MEETING_LABEL[otherGender];
  if (label) return label;
  return 'Non-binary';
}

export function meetingPrefAcceptsGender(
  meetingPrefs: string[] | string | null | undefined,
  otherGender: string | null | undefined,
): boolean {
  const prefs = typeof meetingPrefs === 'string' ? [meetingPrefs] : meetingPrefs ?? [];
  if (!otherGender || !prefs.length) return false;
  if (prefs.includes('Everyone')) return true;
  const label = meetingLabelForGender(otherGender);
  if (!label) return false;
  return prefs.includes(label);
}

/** Hard filter: mutual gender ↔ meeting preference compatibility. */
export function meetingPreferencesMutuallyCompatible(
  genderA: string | null | undefined,
  meetingPrefsA: string[] | string | null | undefined,
  genderB: string | null | undefined,
  meetingPrefsB: string[] | string | null | undefined,
): boolean {
  return (
    meetingPrefAcceptsGender(meetingPrefsB, genderA) && meetingPrefAcceptsGender(meetingPrefsA, genderB)
  );
}

/** Hard filter: same city (case-insensitive trim). */
export function sameCityHardFilter(
  cityA: string | null | undefined,
  cityB: string | null | undefined,
): boolean {
  if (!cityA?.trim() || !cityB?.trim()) return false;
  return cityA.trim().toLowerCase() === cityB.trim().toLowerCase();
}

/**
 * Hard filter: at least one shared language (normalized lowercase).
 * Both sides must list at least one language with a non-empty intersection.
 */
export function languagesHardCompatible(
  languagesA: string[] | string | null | undefined,
  languagesB: string[] | string | null | undefined,
): boolean {
  const a = normalizeLangList(languagesA);
  const b = new Set(normalizeLangList(languagesB));
  if (!a.length || !b.size) return false;
  return a.some((x) => b.has(x));
}

/** Same district bonus: +30 if both set and equal (case-insensitive). */
export function districtBonusScore(
  districtA: string | null | undefined,
  districtB: string | null | undefined,
): number {
  if (!districtA?.trim() || !districtB?.trim()) return 0;
  return districtA.trim().toLowerCase() === districtB.trim().toLowerCase() ? 30 : 0;
}

export type Setup1MatchFields = {
  city: string | null | undefined;
  district: string | null | undefined;
  date_of_birth: string | null | undefined;
  gender: string | null | undefined;
  meeting_preferences: string[] | null | undefined;
  languages: string[] | null | undefined;
};

/** All Setup-1 hard gates for a pair. */
export function setup1HardFiltersPass(a: Setup1MatchFields, b: Setup1MatchFields): boolean {
  return (
    sameCityHardFilter(a.city, b.city) &&
    meetingPreferencesMutuallyCompatible(a.gender, a.meeting_preferences, b.gender, b.meeting_preferences) &&
    languagesHardCompatible(a.languages, b.languages)
  );
}

/** Sum of Setup-1 scoring components (after hard filters). */
export function setup1ScoreTotal(a: Setup1MatchFields, b: Setup1MatchFields, ref: Date = new Date()): number {
  return districtBonusScore(a.district, b.district) + ageDifferenceScore(a.date_of_birth, b.date_of_birth, ref);
}
