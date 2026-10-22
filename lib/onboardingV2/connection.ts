// "How do you connect?" — optional questions before the first submit
// (owner decisions 2026-10-22, D104; a first draft — the questions will change:
// bump CONNECTION_VERSION and the server catalog together). Pure.
// Stable ids only are stored; the texts below are display copy. Answers are
// private: not on the profile, not used for matching or review. No result,
// type or score is ever derived from them.

export const CONNECTION_VERSION = 1;

export type ConnectionQuestion = { id: string; title: string; options: { key: string; title: string }[] };

export const CONNECTION_QUESTIONS: ConnectionQuestion[] = [
  {
    id: 'meet_new',
    title: 'When meeting someone new, I usually…',
    options: [
      { key: 'open_quickly', title: 'Open up quickly' },
      { key: 'take_time', title: 'Take my time' },
      { key: 'depends', title: 'It depends on the person' },
    ],
  },
  {
    id: 'when_bothered',
    title: 'When something bothers me, I prefer to…',
    options: [
      { key: 'talk_now', title: 'Talk about it straight away' },
      { key: 'time_then_talk', title: 'Take some time, then talk' },
      { key: 'depends', title: 'Decide depending on the situation' },
    ],
  },
  {
    id: 'time_together',
    title: 'For spending time together, I enjoy…',
    options: [
      { key: 'plans_ahead', title: 'Making plans ahead' },
      { key: 'spontaneous', title: 'Being spontaneous' },
      { key: 'both', title: 'A bit of both' },
    ],
  },
  {
    id: 'show_care',
    title: 'I tend to show I care through…',
    options: [
      { key: 'words', title: 'Words and encouragement' },
      { key: 'quality_time', title: 'Quality time together' },
      { key: 'actions', title: 'Thoughtful actions' },
      { key: 'mix', title: 'A mix of these' },
    ],
  },
];

export const CONNECTION_COPY = {
  title: 'How do you connect?',
  helper: 'A few optional questions about what feels right for you in a relationship.',
  explore: 'Explore',
  skip: 'Skip for now',
  privacy: 'Private: your answers aren’t shown on your profile and aren’t used for matching.',
  skipQuestion: 'Skip',
  skipRest: 'Skip the rest',
};

export type ConnectionAnswers = Record<string, string>;

/** Keeps only known question ids with a valid option (old / foreign data is dropped). */
export function cleanConnectionAnswers(raw: unknown): ConnectionAnswers {
  const out: ConnectionAnswers = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const q of CONNECTION_QUESTIONS) {
    const v = (raw as Record<string, unknown>)[q.id];
    if (typeof v === 'string' && q.options.some((o) => o.key === v)) out[q.id] = v;
  }
  return out;
}

/**
 * Stage of the optional interstitial on the live first-submit screen:
 * 'invite' → question 0..n-1 → 'done' (the normal submit screen).
 */
export type ConnectStage = 'invite' | number | 'done';

export const nextConnectStage = (s: ConnectStage): ConnectStage =>
  s === 'invite' ? 0 : typeof s === 'number' ? (s + 1 < CONNECTION_QUESTIONS.length ? s + 1 : 'done') : 'done';

export const prevConnectStage = (s: ConnectStage): ConnectStage | null =>
  s === 'invite' || s === 'done' ? null : s === 0 ? 'invite' : s - 1;
