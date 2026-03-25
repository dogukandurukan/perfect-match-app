type MaybeText = string | null | undefined;

export type Setup4Fields = {
  availability_days?: string[] | null;
  availability_hours?: string[] | null;
  meeting_environment?: string[] | null;
  first_date_expectation?: MaybeText;
  bio?: MaybeText;
};

function normalizeList(values: string[] | null | undefined): string[] {
  return [...new Set((values ?? []).map((v) => v.trim().toLowerCase()).filter(Boolean))];
}

function overlapCount(a: string[] | null | undefined, b: string[] | null | undefined): number {
  const aa = normalizeList(a);
  const bb = new Set(normalizeList(b));
  return aa.filter((x) => bb.has(x)).length;
}

/** Days score: 5+ +40, 3-4 +25, 1-2 +10, 0 -20. */
export function availabilityDaysScore(
  daysA: string[] | null | undefined,
  daysB: string[] | null | undefined,
): number {
  const common = overlapCount(daysA, daysB);
  if (common >= 5) return 40;
  if (common >= 3) return 25;
  if (common >= 1) return 10;
  return -20;
}

/** Hours score: 3 +30, 2 +20, 1 +10, 0 -15. */
export function availabilityHoursScore(
  hoursA: string[] | null | undefined,
  hoursB: string[] | null | undefined,
): number {
  const common = overlapCount(hoursA, hoursB);
  if (common >= 3) return 30;
  if (common === 2) return 20;
  if (common === 1) return 10;
  return -15;
}

/** Meeting environment score: 4-5 +30, 3 +20, 2 +15, 1 +10, 0 -10. */
export function meetingEnvironmentScore(
  envA: string[] | null | undefined,
  envB: string[] | null | undefined,
): number {
  const common = overlapCount(envA, envB);
  if (common >= 4) return 30;
  if (common === 3) return 20;
  if (common === 2) return 15;
  if (common === 1) return 10;
  return -10;
}

/** First date expectation score: same +15, one side all-of-the-above +8, else 0. */
export function firstDateExpectationScore(a: MaybeText, b: MaybeText): number {
  if (!a || !b) return 0;
  if (a === b) return 15;
  if (a === 'All of the above' || b === 'All of the above') return 8;
  return 0;
}

/** Bonus when the user has bio filled. */
export function bioBonusScore(bio: MaybeText): number {
  return bio && bio.trim().length > 0 ? 5 : 0;
}

/** Pair score from Setup-4. Bio bonus max +5 as defined in spec. */
export function setup4ScoreTotal(a: Setup4Fields, b: Setup4Fields): number {
  return (
    availabilityDaysScore(a.availability_days, b.availability_days) +
    availabilityHoursScore(a.availability_hours, b.availability_hours) +
    meetingEnvironmentScore(a.meeting_environment, b.meeting_environment) +
    firstDateExpectationScore(a.first_date_expectation, b.first_date_expectation) +
    Math.max(bioBonusScore(a.bio), bioBonusScore(b.bio))
  );
}
