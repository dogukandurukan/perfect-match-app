type MaybeText = string | null | undefined;

export type Setup4Fields = {
  availability_days?: string[] | null;
  availability_hours?: string[] | null;
  meeting_environment?: string[] | null;
  /** Optional: max 3 neighborhoods. Scoring bonus if overlap exists. */
  preferred_locations?: string[] | null;
  first_date_expectation?: MaybeText;
  bio?: MaybeText;
};

function toStringArray(v: string | string[] | null | undefined): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

function normalizeList(values: string | string[] | null | undefined): string[] {
  return [
    ...new Set(
      toStringArray(values)
        .map((v) =>
          v
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''),
        )
        .filter(Boolean),
    ),
  ];
}

function overlapCount(a: string | string[] | null | undefined, b: string | string[] | null | undefined): number {
  const aa = normalizeList(a);
  const bb = new Set(normalizeList(b));
  return aa.filter((x) => bb.has(x)).length;
}

/** Days score: 5+ +50, 3-4 +25, 1-2 +10, 0 -20. */
export function availabilityDaysScore(
  daysA: string[] | string | null | undefined,
  daysB: string[] | string | null | undefined,
): number {
  if (daysA == null && daysB == null) return 0;
  if (daysA == null || daysB == null) return 0;
  const common = overlapCount(daysA, daysB);
  if (common >= 5) return 50;
  if (common >= 3) return 25;
  if (common >= 1) return 10;
  return -20;
}

/** Hours score: 3 +30, 2 +20, 1 +10, 0 -5. */
export function availabilityHoursScore(
  hoursA: string[] | string | null | undefined,
  hoursB: string[] | string | null | undefined,
): number {
  if (hoursA == null && hoursB == null) return 0;
  if (hoursA == null || hoursB == null) return 0;
  const common = overlapCount(hoursA, hoursB);
  if (common >= 3) return 30;
  if (common === 2) return 20;
  if (common === 1) return 10;
  return -5;
}

/** Meeting environment score: 4-5 +30, 3 +20, 2 +15, 1 +10, 0 -10. */
export function meetingEnvironmentScore(
  envA: string[] | string | null | undefined,
  envB: string[] | string | null | undefined,
): number {
  if (envA == null && envB == null) return 0;
  if (envA == null || envB == null) return 0;
  const common = overlapCount(envA, envB);
  if (common >= 4) return 30;
  if (common === 3) return 20;
  if (common === 2) return 15;
  if (common === 1) return 10;
  return -10;
}

/** First date expectation score: same +15, one side all-of-the-above +8, else 0. İki taraf da boş/null → 0. */
export function firstDateExpectationScore(a: MaybeText, b: MaybeText): number {
  const sa = a == null ? '' : String(a).trim();
  const sb = b == null ? '' : String(b).trim();
  if (!sa && !sb) return 0;
  if (!sa || !sb) return 0;
  if (sa === sb) return 15;
  if (sa === 'All of the above' || sb === 'All of the above') return 8;
  return 0;
}

/** Preferred locations score: 1 common +15, 2+ common +20, 0 common +0. */
export function preferredLocationsScore(
  preferredA: string[] | string | null | undefined,
  preferredB: string[] | string | null | undefined,
): number {
  const common = overlapCount(preferredA, preferredB);
  if (common === 1) return 15;
  if (common >= 2) return 20;
  return 0;
}

/** Bonus when the user has bio filled. */
export function bioBonusScore(bio: MaybeText): number {
  return bio && bio.trim().length > 0 ? 5 : 0;
}

/** Çift bio bonusu: iki taraf da boş → 0; aksi halde tek taraflı doluysa max +5. */
export function bioPairBonusScore(bioA: MaybeText, bioB: MaybeText): number {
  const ta = bioA != null && String(bioA).trim().length > 0 ? String(bioA).trim() : '';
  const tb = bioB != null && String(bioB).trim().length > 0 ? String(bioB).trim() : '';
  if (!ta && !tb) return 0;
  return Math.max(ta ? 5 : 0, tb ? 5 : 0);
}

/** Pair score from Setup-4. Bio bonus max +5 as defined in spec. */
export function setup4ScoreTotal(a: Setup4Fields, b: Setup4Fields): number {
  return (
    availabilityDaysScore(a.availability_days, b.availability_days) +
    availabilityHoursScore(a.availability_hours, b.availability_hours) +
    meetingEnvironmentScore(a.meeting_environment, b.meeting_environment) +
    preferredLocationsScore(a.preferred_locations, b.preferred_locations) +
    firstDateExpectationScore(a.first_date_expectation, b.first_date_expectation) +
    bioPairBonusScore(a.bio, b.bio)
  );
}
