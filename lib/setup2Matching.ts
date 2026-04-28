import type { IntentKey } from '@/lib/onboardingIntent';

type MaybeText = string | null | undefined;

export type Setup2AnswersFields = {
  friendship_value?: MaybeText;
  hangout_frequency?: MaybeText;
  social_preference?: MaybeText;
  casualness_expectation?: MaybeText;
  exclusivity_view?: MaybeText;
  connection_style?: MaybeText;
  marriage_view?: MaybeText;
  children_view?: MaybeText;
  relationship_pace?: MaybeText;
  life_priority?: MaybeText;
  excitement_factor?: MaybeText;
  commitment_view?: MaybeText;
  connection_energy?: MaybeText;
};

const SETUP2_KEYS: (keyof Setup2AnswersFields)[] = [
  'friendship_value',
  'hangout_frequency',
  'social_preference',
  'casualness_expectation',
  'exclusivity_view',
  'connection_style',
  'marriage_view',
  'children_view',
  'relationship_pace',
  'life_priority',
  'excitement_factor',
  'commitment_view',
  'connection_energy',
];

/** Trim + unicode quotes; avoids +0 when DB/UI strings differ only by whitespace or ’ vs '. */
export function normalizeSetup2AnswerText(v: MaybeText): string {
  if (v == null) return '';
  return String(v)
    .trim()
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"');
}

/**
 * onboarding_answers kolonları ile preferences.setup2_answers birleşimi:
 * dolu olan kolon öncelikli; ikisi de boşsa alan yok sayılır.
 */
export function mergeSetup2Sources(
  onboardingRowRest: Record<string, unknown>,
  prefsSetup2: Setup2AnswersFields | null | undefined,
): Setup2AnswersFields {
  const out: Setup2AnswersFields = {};
  for (const k of SETUP2_KEYS) {
    const rowVal = onboardingRowRest[k as string];
    const prefVal = prefsSetup2?.[k];
    const fromRow = typeof rowVal === 'string' && rowVal.trim() !== '' ? rowVal : null;
    const fromPref = typeof prefVal === 'string' && prefVal.trim() !== '' ? prefVal : null;
    const pick = fromRow ?? fromPref;
    if (pick != null) out[k] = pick;
  }
  return out;
}

/** Aynı → +12; biri Both/All/Mix/Everything içeriyorsa → +6; farklı → 0 */
export function setup2PairScore(
  a: MaybeText,
  b: MaybeText,
  _flexIfNotSame: readonly string[] = [],
): number {
  const na = (a ?? '').trim().toLowerCase();
  const nb = (b ?? '').trim().toLowerCase();
  if (na === '' || nb === '') return 0;
  if (na === nb) return 12;
  if (
    na.includes('both') ||
    na.includes('all') ||
    na.includes('mix') ||
    na.includes('everything') ||
    nb.includes('both') ||
    nb.includes('all') ||
    nb.includes('mix') ||
    nb.includes('everything')
  ) {
    return 6;
  }
  return 0;
}

export function intentScore(a: IntentKey, b: IntentKey): number {
  if (a === 'sports_partner' || b === 'sports_partner') {
    return a === 'sports_partner' && b === 'sports_partner' ? 45 : 0;
  }
  if (a === 'not_sure_yet' && b === 'not_sure_yet') return 28;
  if (a === b) return 45;
  if (a === 'not_sure_yet' || b === 'not_sure_yet') return 20;
  return 0;
}

/**
 * Setup2 üst sınırı (intent + alt soruların tam puanı):
 * just_friends/keeping 81, open_to_relationship 93,
 * not_sure_yet×not_sure_yet 64, not_sure_yet×diğer 56.
 */
export function setup2MaxPossible(intentA: IntentKey, intentB: IntentKey): number {
  if (intentA === 'sports_partner' && intentB === 'sports_partner') return 45;
  if (intentA === 'not_sure_yet' && intentB === 'not_sure_yet') return 64;
  if (intentA === 'not_sure_yet' || intentB === 'not_sure_yet') return 56;
  if (intentA === 'just_friends' && intentB === 'just_friends') return 81;
  if (intentA === 'keeping_it_casual' && intentB === 'keeping_it_casual') return 81;
  if (intentA === 'open_to_relationship' && intentB === 'open_to_relationship') return 93;
  return 0;
}

export function setup2AnswersScore(
  intentA: IntentKey,
  answersA: Setup2AnswersFields,
  intentB: IntentKey,
  answersB: Setup2AnswersFields,
): number {
  let score = intentScore(intentA, intentB);

  const FLEX_MIX = ['Mix of everything', 'Both', 'All of the above', 'A bit of everything'] as const;

  if (intentA === 'just_friends' && intentB === 'just_friends') {
    score += setup2PairScore(answersA.friendship_value, answersB.friendship_value, FLEX_MIX);
    score += setup2PairScore(answersA.hangout_frequency, answersB.hangout_frequency, ['Whenever it happens']);
    score += setup2PairScore(answersA.social_preference, answersB.social_preference, ['Mix of everything']);
  }

  if (intentA === 'keeping_it_casual' && intentB === 'keeping_it_casual') {
    score += setup2PairScore(answersA.casualness_expectation, answersB.casualness_expectation, ['All of the above']);
    score += setup2PairScore(answersA.exclusivity_view, answersB.exclusivity_view, FLEX_MIX);
    score += setup2PairScore(answersA.connection_style, answersB.connection_style, ['A bit of everything']);
  }

  if (intentA === 'open_to_relationship' && intentB === 'open_to_relationship') {
    score += setup2PairScore(answersA.marriage_view, answersB.marriage_view, []);
    score += setup2PairScore(answersA.children_view, answersB.children_view, []);
    score += setup2PairScore(answersA.relationship_pace, answersB.relationship_pace, ['Not sure yet']);
    score += setup2PairScore(answersA.life_priority, answersB.life_priority, ['Balance of everything']);
  }

  if (intentA === 'not_sure_yet' && intentB === 'not_sure_yet') {
    score += setup2PairScore(answersA.excitement_factor, answersB.excitement_factor, ['Just seeing what happens']);
    score += setup2PairScore(answersA.commitment_view, answersB.commitment_view, [
      'Open to whatever feels right',
      'Not thinking about it yet',
    ]);
    score += setup2PairScore(answersA.connection_energy, answersB.connection_energy, ['Still figuring it out']);
  }

  return score;
}

/** Adım adım setup2 (not_sure_yet çifti için detaylı). */
export function explainSetup2Score(
  intentA: IntentKey,
  answersA: Setup2AnswersFields,
  intentB: IntentKey,
  answersB: Setup2AnswersFields,
  log: (msg: string) => void = console.log,
): void {
  const intentPts = intentScore(intentA, intentB);
  log(`[setup2] intent: ${intentA} ↔ ${intentB} → +${intentPts}`);

  if (intentA === 'not_sure_yet' && intentB === 'not_sure_yet') {
    const rows: [string, keyof Setup2AnswersFields, readonly string[]][] = [
      ['excitement_factor', 'excitement_factor', ['Just seeing what happens']],
      [
        'commitment_view',
        'commitment_view',
        ['Open to whatever feels right', 'Not thinking about it yet'],
      ],
      ['connection_energy', 'connection_energy', ['Still figuring it out']],
    ];
    for (const [label, key, flex] of rows) {
      const va = answersA[key];
      const vb = answersB[key];
      const pts = setup2PairScore(va, vb, flex);
      log(
        `  ${label}: A=${JSON.stringify(va)} → norm="${normalizeSetup2AnswerText(va)}" | B=${JSON.stringify(vb)} → norm="${normalizeSetup2AnswerText(vb)}" → +${pts}`,
      );
    }
  } else {
    log('  (detaylı satır satır sadece not_sure_yet ↔ not_sure_yet için yazıldı)');
  }

  const total = setup2AnswersScore(intentA, answersA, intentB, answersB);
  log(`[setup2] TOTAL: ${total}`);
}
