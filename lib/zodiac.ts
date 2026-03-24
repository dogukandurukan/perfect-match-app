export type ZodiacInfo = {
  symbol: string;
  /** English name for DB / profile display */
  sign: string;
};

/** Western zodiac from calendar month (1–12) and day. */
export function getZodiacFromParts(month: number, day: number): ZodiacInfo | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const md = month * 100 + day;

  if (md >= 1222 || md <= 119) return { sign: 'Capricorn', symbol: '♑' };
  if (md <= 218) return { sign: 'Aquarius', symbol: '♒' };
  if (md <= 320) return { sign: 'Pisces', symbol: '♓' };
  if (md <= 419) return { sign: 'Aries', symbol: '♈' };
  if (md <= 520) return { sign: 'Taurus', symbol: '♉' };
  if (md <= 620) return { sign: 'Gemini', symbol: '♊' };
  if (md <= 722) return { sign: 'Cancer', symbol: '♋' };
  if (md <= 822) return { sign: 'Leo', symbol: '♌' };
  if (md <= 922) return { sign: 'Virgo', symbol: '♍' };
  if (md <= 1022) return { sign: 'Libra', symbol: '♎' };
  if (md <= 1121) return { sign: 'Scorpio', symbol: '♏' };
  if (md <= 1221) return { sign: 'Sagittarius', symbol: '♐' };

  return { sign: 'Capricorn', symbol: '♑' };
}

export function getZodiacFromDate(date: Date): ZodiacInfo | null {
  return getZodiacFromParts(date.getMonth() + 1, date.getDate());
}

export function formatZodiacTooltip(info: ZodiacInfo): string {
  return `${info.symbol} ${info.sign}`;
}

export function calculateAge(dateOfBirth: Date, ref: Date = new Date()): number {
  let age = ref.getFullYear() - dateOfBirth.getFullYear();
  const m = ref.getMonth() - dateOfBirth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < dateOfBirth.getDate())) age--;
  return age;
}
