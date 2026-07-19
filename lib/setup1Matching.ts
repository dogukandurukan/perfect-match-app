// Screen: Setup 1 yaş skorlama | Status: stable | Last updated: Mayıs 2026
/**
 * Age-gap helpers for Setup-1 soft scoring (used by `profileMatching.setup1ScoreTotal`).
 * District bonus lives in profileMatching (+30); age uses the tiers below.
 */

type DobInput = string | null | undefined;

function parseDob(dob: DobInput): Date | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Whole years of age on `ref` (same calendar logic as feed `safeAge`). */
function ageOnDate(dob: Date, ref: Date): number {
  let age = ref.getFullYear() - dob.getFullYear();
  const m = ref.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dob.getDate())) age -= 1;
  return Math.max(0, age);
}

/**
 * Absolute difference in whole years between two dates of birth.
 * Returns `null` if either DOB is missing/invalid.
 */
export function absAgeGapYears(
  dobA: DobInput,
  dobB: DobInput,
  ref: Date = new Date(),
): number | null {
  const a = parseDob(dobA);
  const b = parseDob(dobB);
  if (!a || !b) return null;
  return Math.abs(ageOnDate(a, ref) - ageOnDate(b, ref));
}

/**
 * Soft score from age proximity (both DOBs required).
 * 0–1y → +20; 2–3y → +12; 4–5y → +6; else / missing → 0.
 */
export function ageDifferenceScore(
  dobA: DobInput,
  dobB: DobInput,
  ref: Date = new Date(),
): number {
  const gap = absAgeGapYears(dobA, dobB, ref);
  if (gap == null) return 0;
  if (gap <= 1) return 20;
  if (gap <= 3) return 12;
  if (gap <= 5) return 6;
  return 0;
}
