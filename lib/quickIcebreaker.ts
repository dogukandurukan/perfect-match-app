// Quick "this or that" icebreaker — replaces the old profile-field-comparison
// icebreakers (lib/icebreakers.ts, removed) which read as generic/shallow
// ("you both like travel, where'd you last go?") — user feedback, 2026-09-09.
// v1 is single-player and ephemeral: no DB table, no synced two-player
// reveal. You tap through 5 quick picks, the app turns them into one opening
// line and drops it in the input box for you to send/edit.

export type QuickIcebreakerChoice = 'A' | 'B';

export type QuickIcebreakerOption = { label: string; emoji: string };

export type QuickIcebreakerQuestion = {
  id: string;
  optionA: QuickIcebreakerOption;
  optionB: QuickIcebreakerOption;
};

export const QUICK_ICEBREAKER_QUESTIONS: QuickIcebreakerQuestion[] = [
  { id: 'pet', optionA: { label: 'Cat', emoji: '🐱' }, optionB: { label: 'Dog', emoji: '🐶' } },
  { id: 'drink', optionA: { label: 'Tea', emoji: '🍵' }, optionB: { label: 'Coffee', emoji: '☕' } },
  { id: 'alcohol', optionA: { label: 'Beer', emoji: '🍺' }, optionB: { label: 'Wine', emoji: '🍷' } },
  { id: 'genre', optionA: { label: 'Comedy', emoji: '😂' }, optionB: { label: 'Drama', emoji: '🎬' } },
  { id: 'getaway', optionA: { label: 'Beach', emoji: '🏖️' }, optionB: { label: 'Mountains', emoji: '⛰️' } },
];

/** Turns 5 A/B picks into one ready-to-send opening line. */
export function buildQuickIcebreakerLine(answers: QuickIcebreakerChoice[]): string {
  const picks = QUICK_ICEBREAKER_QUESTIONS.map((q, i) =>
    answers[i] === 'A' ? q.optionA : q.optionB,
  );
  const joined = picks.map((p) => `${p.emoji} ${p.label}`).join(', ');
  return `${joined} — that's me. You?`;
}
