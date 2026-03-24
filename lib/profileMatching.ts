/**
 * Setup-1 profile fields used for discovery / scoring (gender ↔ meeting preferences, languages).
 */

const GENDER_TO_MEETING_LABEL: Record<string, 'Men' | 'Women' | 'Non-binary'> = {
  Man: 'Men',
  Woman: 'Women',
  'Non-binary': 'Non-binary',
};

/** Other user's profile `gender` is acceptable if it appears in `meetingPrefs` (or Everyone). */
export function meetingPrefAcceptsGender(meetingPrefs: string[] | null | undefined, otherGender: string | null | undefined): boolean {
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

/** Soft filter bonus: +10 if at least one shared language. */
export function languageOverlapBonus(
  languagesA: string[] | null | undefined,
  languagesB: string[] | null | undefined,
): number {
  const a = languagesA?.map((s) => s.trim().toLowerCase()).filter(Boolean) ?? [];
  const b = new Set(languagesB?.map((s) => s.trim().toLowerCase()).filter(Boolean) ?? []);
  if (!a.length || !b.size) return 0;
  return a.some((x) => b.has(x)) ? 10 : 0;
}
