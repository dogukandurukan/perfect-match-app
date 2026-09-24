// Tempa onboarding V2 — Section 3 Compatibility (P03, copy revised in P03 R1):
// approved copy (docs/tempa/ONBOARDING_FLOW.md §3, DECISIONS D17–D21, D50, D51)
// and pure draft logic.
// Intent keys long_term / casual / figuring_out are approved (D20); every other
// key here is a local preview key and does NOT approve a backend schema.

export const COMPAT_TOTAL_STEPS = 7;

export type CompatOption = { key: string; title: string };
export type SingleQuestion = {
  id: SingleKey;
  title: string;
  /** Optional small line under the title (P03 R1). */
  helper?: string;
  options: CompatOption[];
};

export type SingleKey =
  | 'intent'
  | 'socialEnergy'
  | 'messageFrequency'
  | 'relationshipSpace'
  | 'emotionalExpression'
  | 'meetingPace';

// Approved simpler copy (P03 R1, DECISIONS D50). Question IDs and option keys
// are unchanged from P03 and keep their order — display copy only.
export const SINGLE_QUESTIONS: SingleQuestion[] = [
  {
    id: 'intent',
    title: 'What are you looking for?',
    options: [
      { key: 'long_term', title: 'A serious relationship' },
      { key: 'casual', title: 'Something casual' },
      { key: 'figuring_out', title: 'Not sure yet' },
    ],
  },
  {
    id: 'socialEnergy',
    title: 'How social are you?',
    options: [
      { key: 'low_key', title: 'I like quiet plans' },
      { key: 'mix', title: 'Somewhere in between' },
      { key: 'social', title: 'I love going out' },
    ],
  },
  {
    id: 'messageFrequency',
    title: 'How often do you like to text?',
    helper: 'When dating someone',
    options: [
      { key: 'little_each_day', title: 'A few messages a day' },
      { key: 'few_checkins', title: 'A few times a day' },
      { key: 'often', title: 'Often during the day' },
    ],
  },
  {
    id: 'relationshipSpace',
    title: 'How much time together feels right?',
    helper: 'When dating someone',
    options: [
      { key: 'plenty_of_space', title: 'More time for myself' },
      { key: 'balance', title: 'A balance of both' },
      { key: 'lots_together', title: 'Lots of time together' },
    ],
  },
  {
    id: 'emotionalExpression',
    title: 'Is it easy to share your feelings?',
    options: [
      { key: 'reserved', title: 'I need time' },
      { key: 'warm_when_comfortable', title: 'Once I feel comfortable' },
      { key: 'open', title: "Yes, I'm open" },
    ],
  },
  {
    id: 'meetingPace',
    title: 'When would you like to meet?',
    options: [
      { key: 'quickly', title: 'Soon' },
      { key: 'after_chatting', title: 'After some chatting' },
      { key: 'take_my_time', title: 'When I feel ready' },
    ],
  },
];

export const VALUES_TITLE = 'What matters most to you?';
export const VALUES_HELPER = 'In a relationship. Pick 1 or 2.';
export const MAX_VALUES = 2;
// 2 columns × 5 rows, row-major (P03 R1 / D51). Existing keys kept for renamed
// labels; `respect` is a new LOCAL preview key only (no backend/scoring).
// `icon` = outline glyph from icon sets already bundled with @expo/vector-icons
// (MaterialCommunityIcons "mci", Ionicons "ion") — no new dependency.
export type ValueIcon = { family: 'mci' | 'ion'; name: string };
export const VALUE_OPTIONS: { key: string; label: string; icon: ValueIcon }[] = [
  { key: 'trust', label: 'Trust', icon: { family: 'mci', name: 'link-variant' } },
  { key: 'growth', label: 'Growing together', icon: { family: 'mci', name: 'sprout-outline' } },
  { key: 'fun', label: 'Fun', icon: { family: 'ion', name: 'sunny-outline' } },
  { key: 'stability', label: 'Stability', icon: { family: 'mci', name: 'anchor' } },
  { key: 'independence', label: 'Personal space', icon: { family: 'mci', name: 'feather' } },
  { key: 'adventure', label: 'Adventure', icon: { family: 'mci', name: 'compass-outline' } },
  { key: 'affection', label: 'Affection', icon: { family: 'mci', name: 'heart-outline' } },
  { key: 'family', label: 'Family', icon: { family: 'mci', name: 'home-outline' } },
  { key: 'health', label: 'Health', icon: { family: 'ion', name: 'leaf-outline' } },
  { key: 'respect', label: 'Respect', icon: { family: 'mci', name: 'handshake-outline' } },
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
