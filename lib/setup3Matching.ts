type MaybeText = string | null | undefined;

export type Setup3Fields = {
  morning_night?: MaybeText;
  recharge_style?: MaybeText;
  hobbies?: string[] | null;
  vibe?: MaybeText;
  drinking?: MaybeText;
  smoking?: MaybeText;
  pets?: MaybeText;
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

function overlapCount(a: string[] | null | undefined, b: string[] | null | undefined): number {
  const aa = [...new Set((a ?? []).map((x) => normalizeText(x)).filter(Boolean))];
  const bb = new Set((b ?? []).map((x) => normalizeText(x)).filter(Boolean));
  return aa.filter((x) => bb.has(x)).length;
}

export function morningNightScore(a: MaybeText, b: MaybeText): number {
  return eq(a, b) ? 10 : 0;
}

export function rechargeStyleScore(a: MaybeText, b: MaybeText): number {
  return eq(a, b) ? 10 : 0;
}

export function hobbiesScore(a: string[] | null | undefined, b: string[] | null | undefined): number {
  const common = overlapCount(a, b);
  if (common <= 0) return 0;
  if (common === 1) return 15;
  if (common === 2) return 20;
  if (common === 3) return 25;
  if (common === 4) return 30;
  return 35;
}

export function vibeScore(a: MaybeText, b: MaybeText): number {
  return eq(a, b) ? 15 : 0;
}

export function drinkingScore(a: MaybeText, b: MaybeText): number {
  return eq(a, b) ? 10 : 0;
}

export function smokingScore(a: MaybeText, b: MaybeText): number {
  return eq(a, b) ? 10 : 0;
}

export function petsScore(a: MaybeText, b: MaybeText): number {
  return eq(a, b) ? 5 : 0;
}

export function educationScore(
  educationA: MaybeText,
  educationB: MaybeText,
  detailA: MaybeText,
  detailB: MaybeText,
): number {
  if (!eq(educationA, educationB)) return 0;
  let score = 15;
  if (eqNormalized(detailA, detailB)) score += 20;
  return score;
}

export function religionScore(a: MaybeText, b: MaybeText): number {
  if (!a || !b) return 0;
  if (a === 'Prefer not to say' || b === 'Prefer not to say') return 0;
  if (a === b) return 20;

  const pair = [a, b].sort().join('|');
  switch (pair) {
    case 'Religious|Spiritual':
      return 10;
    case 'Agnostic|Atheist':
      return 10;
    case 'Agnostic|Spiritual':
      return 5;
    case 'Agnostic|Religious':
      return -5;
    case 'Atheist|Spiritual':
      return -5;
    case 'Atheist|Religious':
      return -15;
    default:
      return 0;
  }
}

export function setup3ScoreTotal(a: Setup3Fields, b: Setup3Fields): number {
  return (
    morningNightScore(a.morning_night, b.morning_night) +
    rechargeStyleScore(a.recharge_style, b.recharge_style) +
    hobbiesScore(a.hobbies ?? null, b.hobbies ?? null) +
    vibeScore(a.vibe, b.vibe) +
    drinkingScore(a.drinking, b.drinking) +
    smokingScore(a.smoking, b.smoking) +
    petsScore(a.pets, b.pets) +
    educationScore(a.education, b.education, a.education_detail, b.education_detail) +
    religionScore(a.religion, b.religion)
  );
}
