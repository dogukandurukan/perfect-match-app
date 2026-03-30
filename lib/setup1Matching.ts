import { calculateAge } from '@/lib/zodiac';

/** Setup-1 üst sınır: ilçe (30) + yaş en iyi (8) = 38 */
export const SETUP1_MAX_POSSIBLE = 38 as const;

function parseDob(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function absAgeGapYears(
  dateOfBirthA: string | null | undefined,
  dateOfBirthB: string | null | undefined,
  ref: Date = new Date(),
): number | null {
  const da = parseDob(dateOfBirthA);
  const db = parseDob(dateOfBirthB);
  if (!da || !db) return null;
  return Math.abs(calculateAge(da, ref) - calculateAge(db, ref));
}

/**
 * Yaş eğrisi (10+ yaş farkı calculateMatchScore’da sert filtre).
 * 0–1:+8, 2–3:+5, 4–5:0, 6–7:-5, 8–9:-10; 10+ için burada 0 (eşleşme zaten elenir).
 */
export function ageDifferenceScore(
  dateOfBirthA: string | null | undefined,
  dateOfBirthB: string | null | undefined,
  ref: Date = new Date(),
): number {
  const diff = absAgeGapYears(dateOfBirthA, dateOfBirthB, ref);
  if (diff == null) return 0;
  if (diff >= 10) return 0;
  if (diff <= 1) return 8;
  if (diff <= 3) return 5;
  if (diff <= 5) return 0;
  if (diff <= 7) return -5;
  if (diff <= 9) return -10;
  return 0;
}
