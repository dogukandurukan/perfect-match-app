// Quick "this or that" icebreaker — replaces the old profile-field-comparison
// icebreakers (lib/icebreakers.ts, removed) which read as generic/shallow
// ("you both like travel, where'd you last go?") — user feedback, 2026-09-09.
//
// v1 is single-player and answered ONCE, ever — a 10-question pool, 5 picked
// at random per user the first time they hit an empty chat, persisted to
// profiles.quick_icebreaker_answers so later matches just reuse the same
// opener instead of re-asking the same 5 questions every time (user
// feedback, 2026-09-10). No synced two-player reveal (that's a bigger,
// separate feature — deferred).

export type QuickIcebreakerChoice = 'A' | 'B';

export type QuickIcebreakerOption = { label: string; emoji: string };

export type QuickIcebreakerQuestion = {
  id: string;
  optionA: QuickIcebreakerOption;
  optionB: QuickIcebreakerOption;
};

export type QuickIcebreakerAnswer = { id: string; choice: QuickIcebreakerChoice };

/** Kept deliberately non-overlapping with existing onboarding fields
 * (drinking, smoking, morning_night, hobbies) — this is meant to add a new,
 * playful signal, not duplicate the serious profile ones. */
export const QUICK_ICEBREAKER_QUESTIONS: QuickIcebreakerQuestion[] = [
  { id: 'pet', optionA: { label: 'Cat', emoji: '🐱' }, optionB: { label: 'Dog', emoji: '🐶' } },
  { id: 'drink', optionA: { label: 'Tea', emoji: '🍵' }, optionB: { label: 'Coffee', emoji: '☕' } },
  { id: 'alcohol', optionA: { label: 'Beer', emoji: '🍺' }, optionB: { label: 'Wine', emoji: '🍷' } },
  { id: 'genre', optionA: { label: 'Comedy', emoji: '😂' }, optionB: { label: 'Drama', emoji: '🎬' } },
  { id: 'getaway', optionA: { label: 'Beach', emoji: '🏖️' }, optionB: { label: 'Mountains', emoji: '⛰️' } },
  {
    id: 'pizza',
    optionA: { label: 'Pineapple on pizza', emoji: '🍍' },
    optionB: { label: 'Never pineapple', emoji: '🙅' },
  },
  { id: 'contact', optionA: { label: 'Texter', emoji: '📱' }, optionB: { label: 'Caller', emoji: '☎️' } },
  { id: 'style', optionA: { label: 'Planner', emoji: '📅' }, optionB: { label: 'Spontaneous', emoji: '🎲' } },
  { id: 'taste', optionA: { label: 'Sweet', emoji: '🍰' }, optionB: { label: 'Savory', emoji: '🧀' } },
  { id: 'seat', optionA: { label: 'Window seat', emoji: '✈️' }, optionB: { label: 'Aisle seat', emoji: '💺' } },
];

/** Random 5-of-10 subset — picked once per user at answer time, then fixed. */
export function pickRandomQuestions(count = 5): QuickIcebreakerQuestion[] {
  const shuffled = [...QUICK_ICEBREAKER_QUESTIONS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** Turns saved/fresh A-B picks into one ready-to-send opening line. */
export function buildQuickIcebreakerLine(answers: QuickIcebreakerAnswer[]): string {
  const byId = new Map(QUICK_ICEBREAKER_QUESTIONS.map((q) => [q.id, q]));
  const picks = answers
    .map((a) => {
      const q = byId.get(a.id);
      if (!q) return null;
      return a.choice === 'A' ? q.optionA : q.optionB;
    })
    .filter((p): p is QuickIcebreakerOption => !!p);
  const joined = picks.map((p) => `${p.emoji} ${p.label}`).join(', ');
  return `${joined} — that's me. You?`;
}
