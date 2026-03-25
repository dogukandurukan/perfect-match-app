/**
 * Setup-1 ↔ matching: gender ↔ meeting preferences, city, languages (hard),
 * plus district / age / height / language-count scoring.
 */

import { calculateAge } from '@/lib/zodiac';

const GENDER_TO_MEETING_LABEL: Record<string, 'Men' | 'Women' | 'Non-binary'> = {
  Man: 'Men',
  Woman: 'Women',
  'Non-binary': 'Non-binary',
};

function normalizeLangList(l: string[] | null | undefined): string[] {
  return [...new Set((l ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean))];
}

export function meetingPrefAcceptsGender(
  meetingPrefs: string[] | null | undefined,
  otherGender: string | null | undefined,
): boolean {
  if (!otherGender || !meetingPrefs?.length) return false;
  if (meetingPrefs.includes('Everyone')) return true;
  const label = GENDER_TO_MEETING_LABEL[otherGender];
  if (!label) return false;
  return meetingPrefs.includes(label);
}

/** Hard filter: mutual gender ↔ meeting preference compatibility. */
export function meetingPreferencesMutuallyCompatible(
  genderA: string | null | undefined,
  meetingPrefsA: string[] | null | undefined,
  genderB: string | null | undefined,
  meetingPrefsB: string[] | null | undefined,
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
  languagesA: string[] | null | undefined,
  languagesB: string[] | null | undefined,
): boolean {
  const a = normalizeLangList(languagesA);
  const b = new Set(normalizeLangList(languagesB));
  if (!a.length || !b.size) return false;
  return a.some((x) => b.has(x));
}

/** Count unique shared languages (for scoring). */
export function sharedLanguageCount(
  languagesA: string[] | null | undefined,
  languagesB: string[] | null | undefined,
): number {
  const a = normalizeLangList(languagesA);
  const b = new Set(normalizeLangList(languagesB));
  return a.filter((x) => b.has(x)).length;
}

/**
 * Language score after hard filter: 1 common → 0, 2 → +5, 3+ → +10.
 */
export function languageCountScore(
  languagesA: string[] | null | undefined,
  languagesB: string[] | null | undefined,
): number {
  const n = sharedLanguageCount(languagesA, languagesB);
  if (n >= 3) return 10;
  if (n === 2) return 5;
  return 0;
}

/** @deprecated Use `languagesHardCompatible` + `languageCountScore`. */
export function languageOverlapBonus(
  languagesA: string[] | null | undefined,
  languagesB: string[] | null | undefined,
): number {
  return languagesHardCompatible(languagesA, languagesB) ? languageCountScore(languagesA, languagesB) : 0;
}

/** Same district bonus: +10 if both set and equal (case-insensitive). */
export function districtBonusScore(
  districtA: string | null | undefined,
  districtB: string | null | undefined,
): number {
  if (!districtA?.trim() || !districtB?.trim()) return 0;
  return districtA.trim().toLowerCase() === districtB.trim().toLowerCase() ? 10 : 0;
}

function parseDob(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Age gap score: same age +10; 1–5 → 0; 5–10 → -10; 10–15 → -20; 15+ → -30.
 */
export function ageDifferenceScore(
  dateOfBirthA: string | null | undefined,
  dateOfBirthB: string | null | undefined,
  ref: Date = new Date(),
): number {
  const da = parseDob(dateOfBirthA);
  const db = parseDob(dateOfBirthB);
  if (!da || !db) return 0;
  const ageA = calculateAge(da, ref);
  const ageB = calculateAge(db, ref);
  const diff = Math.abs(ageA - ageB);
  if (diff === 0) return 10;
  if (diff <= 5) return 0;
  if (diff <= 10) return -10;
  if (diff <= 15) return -20;
  return -30;
}

/**
 * Height score only for Man + Woman pairs. Missing heights → 0 penalty.
 * |diff| >25 → -15; >10 → -5; else 0; woman taller than man → extra -10.
 */
export function heterosexualHeightScore(
  genderA: string | null | undefined,
  genderB: string | null | undefined,
  heightCmA: number | null | undefined,
  heightCmB: number | null | undefined,
): number {
  const pair =
    (genderA === 'Man' && genderB === 'Woman') || (genderA === 'Woman' && genderB === 'Man');
  if (!pair) return 0;

  const manCm = genderA === 'Man' ? heightCmA : heightCmB;
  const womanCm = genderA === 'Woman' ? heightCmA : heightCmB;
  if (manCm == null || womanCm == null) return 0;

  const diff = Math.abs(manCm - womanCm);
  let score = 0;
  if (diff > 25) score -= 15;
  else if (diff > 10) score -= 5;
  if (womanCm > manCm) score -= 10;
  return score;
}

export type Setup1MatchFields = {
  city: string | null | undefined;
  district: string | null | undefined;
  date_of_birth: string | null | undefined;
  gender: string | null | undefined;
  meeting_preferences: string[] | null | undefined;
  languages: string[] | null | undefined;
  height_cm: number | null | undefined;
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
  return (
    districtBonusScore(a.district, b.district) +
    ageDifferenceScore(a.date_of_birth, b.date_of_birth, ref) +
    heterosexualHeightScore(a.gender, b.gender, a.height_cm, b.height_cm) +
    languageCountScore(a.languages, b.languages)
  );
}
