type MaybeText = string | null | undefined;

export type Setup3Fields = {
  morning_night?: MaybeText;
  /** Multi-select: Alone time / With people / With my pet / Mix of everything */
  recharge_style?: string[] | null;
  hobbies?: string[] | null;
  drinking_smoking?: MaybeText;
  education?: MaybeText;
  education_detail?: MaybeText;
  religion?: MaybeText;
};

function eq(a: MaybeText, b: MaybeText): boolean {
  return !!a && !!b && a === b;
}

function normalizeText(v: MaybeText): string {
  return (v ?? '')
    .toLocaleLowerCase('tr-TR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function eqNormalized(a: MaybeText, b: MaybeText): boolean {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  return na.length > 0 && na === nb;
}

function toStringArray(v: string | string[] | null | undefined): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  return [v];
}

function overlapCount(
  a: string | string[] | null | undefined,
  b: string | string[] | null | undefined,
): number {
  const aa = [...new Set(toStringArray(a).map((x) => normalizeText(x)).filter(Boolean))];
  const bb = new Set(toStringArray(b).map((x) => normalizeText(x)).filter(Boolean));
  return aa.filter((x) => bb.has(x)).length;
}

export function morningNightScore(a: MaybeText, b: MaybeText): number {
  return eq(a, b) ? 10 : 0;
}

/** Recharge: at least one shared option → +10 */
export function rechargeStyleScore(
  a: string[] | string | null | undefined,
  b: string[] | string | null | undefined,
): number {
  const common = overlapCount(a, b);
  if (common <= 0) return 0;
  return 10;
}

/** Hobbies: 1 common → +15, each extra +15, max +45 */
export function hobbiesScore(
  a: string[] | string | null | undefined,
  b: string[] | string | null | undefined,
): number {
  const common = overlapCount(a, b);
  if (common <= 0) return 0;
  return Math.min(common * 15, 45);
}

export function hobbiesOverlapCount(
  a: string[] | string | null | undefined,
  b: string[] | string | null | undefined,
): number {
  return overlapCount(a, b);
}

/** Drinking + smoking combined: aynı seçim → +10+10; sosyalleşince → +3+3; uyumsuz → ceza */
export function drinkingSmokingScore(a: MaybeText, b: MaybeText): number {
  if (!a || !b) return 0;
  if (eq(a, b)) return 20;
  if (a === 'When socializing' || b === 'When socializing') return 6;
  return -10;
}

export function educationScore(
  educationA: MaybeText,
  educationB: MaybeText,
  detailA: MaybeText,
  detailB: MaybeText,
): number {
  if (!eq(educationA, educationB)) return 0;
  let score = 10;
  if (eqNormalized(detailA, detailB)) score += 10;
  return score;
}

export function religionScore(a: MaybeText, b: MaybeText): number {
  if (!a || !b) return 0;
  if (a === 'Prefer not to say' || b === 'Prefer not to say') return 0;
  if (a === b) return 5;

  const pair = [a, b].sort().join('|');
  switch (pair) {
    case 'Religious|Spiritual':
      return 3;
    case 'Agnostic|Atheist':
      return 3;
    case 'Agnostic|Spiritual':
      return 2;
    case 'Agnostic|Religious':
      return -3;
    case 'Atheist|Spiritual':
      return -3;
    case 'Atheist|Religious':
      return -5;
    default:
      return 0;
  }
}

export function setup3ScoreTotal(a: Setup3Fields, b: Setup3Fields): number {
  return (
    morningNightScore(a.morning_night, b.morning_night) +
    rechargeStyleScore(a.recharge_style, b.recharge_style) +
    hobbiesScore(a.hobbies ?? null, b.hobbies ?? null) +
    drinkingSmokingScore(a.drinking_smoking, b.drinking_smoking) +
    educationScore(a.education, b.education, a.education_detail, b.education_detail) +
    religionScore(a.religion, b.religion)
  );
}
