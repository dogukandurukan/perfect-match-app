export type ZodiacInfo = {
  sign: string;
  emoji: string;
};

/** Western tropical zodiac from a calendar date (month/day). Matches seed.ts ranges. */
export function getZodiacFromDate(date: Date): ZodiacInfo {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  if (md >= 1222 || md <= 119) return { sign: 'Capricorn', emoji: '♑' };
  if (md <= 218) return { sign: 'Aquarius', emoji: '♒' };
  if (md <= 320) return { sign: 'Pisces', emoji: '♓' };
  if (md <= 419) return { sign: 'Aries', emoji: '♈' };
  if (md <= 520) return { sign: 'Taurus', emoji: '♉' };
  if (md <= 620) return { sign: 'Gemini', emoji: '♊' };
  if (md <= 722) return { sign: 'Cancer', emoji: '♋' };
  if (md <= 822) return { sign: 'Leo', emoji: '♌' };
  if (md <= 922) return { sign: 'Virgo', emoji: '♍' };
  if (md <= 1022) return { sign: 'Libra', emoji: '♎' };
  if (md <= 1121) return { sign: 'Scorpio', emoji: '♏' };
  return { sign: 'Sagittarius', emoji: '♐' };
}

export function calculateAge(date: Date): number {
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const m = now.getMonth() - date.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < date.getDate())) {
    age -= 1;
  }
  return Math.max(0, age);
}

export function formatZodiacTooltip(info: ZodiacInfo): string {
  return `${info.emoji} ${info.sign}`;
}
