// Tempa onboarding V2 — Section 3 Compatibility (P03): canonical copy
// (docs/tempa/ONBOARDING_FLOW.md §3, DECISIONS D17–D21) and pure draft logic.
// Intent keys long_term / casual / figuring_out are approved (D20); every other
// key here is a local preview key and does NOT approve a backend schema.

export const COMPAT_TOTAL_STEPS = 7;

export type CompatOption = { key: string; title: string; subtitle: string };
export type SingleQuestion = { id: SingleKey; title: string; options: CompatOption[] };

export type SingleKey =
  | 'intent'
  | 'socialEnergy'
  | 'messageFrequency'
  | 'relationshipSpace'
  | 'emotionalExpression'
  | 'meetingPace';

export const SINGLE_QUESTIONS: SingleQuestion[] = [
  {
    id: 'intent',
    title: 'What are you looking for?',
    options: [
      { key: 'long_term', title: 'A long-term relationship', subtitle: 'Something meaningful' },
      { key: 'casual', title: 'Something casual', subtitle: 'Keeping things light' },
      { key: 'figuring_out', title: 'Figuring it out', subtitle: "I'm open to seeing where it goes" },
    ],
  },
  {
    id: 'socialEnergy',
    title: "What's your social life like?",
    options: [
      { key: 'low_key', title: 'Mostly low-key', subtitle: 'I like quiet plans and small groups' },
      { key: 'mix', title: 'A mix of both', subtitle: 'It depends on the day' },
      { key: 'social', title: 'Pretty social', subtitle: 'I like going out and meeting people' },
    ],
  },
  {
    id: 'messageFrequency',
    title: "When you're dating someone, how often do you like to message?",
    options: [
      { key: 'little_each_day', title: 'A little each day', subtitle: 'A few messages are enough' },
      { key: 'few_checkins', title: 'A few check-ins', subtitle: 'I like checking in throughout the day' },
      { key: 'often', title: 'Often throughout the day', subtitle: 'I enjoy an ongoing conversation' },
    ],
  },
  {
    id: 'relationshipSpace',
    title: 'How much space do you like in a relationship?',
    options: [
      { key: 'plenty_of_space', title: 'Plenty of space', subtitle: 'I value my independence' },
      { key: 'balance', title: 'A balance of both', subtitle: 'Time together and time apart' },
      { key: 'lots_together', title: 'Lots of time together', subtitle: 'I like feeling close and connected' },
    ],
  },
  {
    id: 'emotionalExpression',
    title: 'How open are you with your feelings?',
    options: [
      { key: 'reserved', title: 'More reserved', subtitle: 'I take time to open up' },
      { key: 'warm_when_comfortable', title: "Warm once I'm comfortable", subtitle: 'I open up as we get closer' },
      { key: 'open', title: 'Pretty open', subtitle: 'I like showing how I feel' },
    ],
  },
  {
    id: 'meetingPace',
    title: 'How soon would you like to meet a match?',
    options: [
      { key: 'quickly', title: 'Pretty quickly', subtitle: "I'd rather meet than text for days" },
      { key: 'after_chatting', title: 'After a little chatting', subtitle: 'I like getting a feel for someone first' },
      { key: 'take_my_time', title: 'I take my time', subtitle: 'I like feeling comfortable first' },
    ],
  },
];

export const VALUES_TITLE = 'In a relationship, I value…';
export const VALUES_HELPER = 'Choose up to 2.';
export const MAX_VALUES = 2;
// 3 × 3 grid, row by row, as in ONBOARDING_FLOW.md §3.7.
export const VALUE_OPTIONS: { key: string; label: string }[] = [
  { key: 'trust', label: 'Trust' },
  { key: 'growth', label: 'Growth' },
  { key: 'fun', label: 'Fun' },
  { key: 'stability', label: 'Stability' },
  { key: 'independence', label: 'Independence' },
  { key: 'adventure', label: 'Adventure' },
  { key: 'affection', label: 'Affection' },
  { key: 'family', label: 'Family' },
  { key: 'health', label: 'Health' },
];

export type CompatDraft = Record<SingleKey, string | null> & { values: string[] };

export const EMPTY_COMPAT_DRAFT: CompatDraft = {
  intent: null,
  socialEnergy: null,
  messageFrequency: null,
  relationshipSpace: null,
  emotionalExpression: null,
  meetingPace: null,
  values: [],
};

/** Toggle a value. Selected values are always deselectable; a third selection
 * is refused (returns the same array) — it never replaces an existing one. */
export function toggleValue(current: string[], key: string): string[] {
  if (current.includes(key)) return current.filter((k) => k !== key);
  if (current.length >= MAX_VALUES) return current;
  return [...current, key];
}

/** step is 1-based within Compatibility (1–6 single questions, 7 values). */
export function isCompatStepValid(step: number, d: CompatDraft): boolean {
  if (step >= 1 && step <= SINGLE_QUESTIONS.length) {
    const q = SINGLE_QUESTIONS[step - 1];
    const v = d[q.id];
    return v !== null && q.options.some((o) => o.key === v);
  }
  if (step === COMPAT_TOTAL_STEPS) return d.values.length >= 1 && d.values.length <= MAX_VALUES;
  return false;
}
