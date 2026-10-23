// "How do you like to connect?" — optional dating-preference questions before
// the first submit (D104; owner revision 2026-10-23). Pure.
// Version 2 replaces the version-1 draft questions: new stable ids, the
// version-1 answers stay on the server untouched and are never read or
// summarised here. Only stable ids are stored; the texts below are display
// copy. Answers are private: not on the profile, not used for matching,
// completeness or review. No score, type or compatibility is derived — the
// summary is a fixed sentence per option.
//
// Two owner-proposed questions are NOT in this set because the required
// onboarding already asks the same thing (Compatibility):
//   "…before meeting in person I prefer…" ≈ "When would you like to meet?"
//   "When getting to know someone, I prefer…" ≈ "How often do you like to text?"

/** The single on/off setting for this optional section. false → the invite,
 * the questions, the summary and the submit-screen card are not shown and the
 * normal submit continues directly; saved answers are kept on the server. */
export const CONNECTION_ENABLED = true;

export const CONNECTION_VERSION = 2;

export type ConnectionOption = { key: string; title: string; summary: string };
export type ConnectionQuestion = { id: string; title: string; summaryTitle: string; icon: string; options: ConnectionOption[] };

export const CONNECTION_QUESTIONS: ConnectionQuestion[] = [
  {
    id: 'plan_first_date',
    title: 'When planning a first date, I like…',
    summaryTitle: 'Making plans',
    icon: 'calendar-outline',
    options: [
      { key: 'decide_together', title: 'Deciding together', summary: 'You like deciding on a first date together.' },
      { key: 'few_options', title: 'Having a few options to choose from', summary: 'You like having a few options to choose from.' },
      { key: 'suggest_first', title: 'Making the first suggestion', summary: 'You like making the first suggestion.' },
      { key: 'any', title: 'Any of these works for me', summary: 'Any way of planning a first date works for you.' },
    ],
  },
  {
    id: 'first_date_comfort',
    title: 'On a first date, I feel more comfortable with…',
    summaryTitle: 'First dates',
    icon: 'cafe-outline',
    options: [
      { key: 'short_casual', title: 'Something short and casual', summary: 'Something short and casual feels most comfortable to you.' },
      { key: 'quiet_place', title: 'A quiet place where we can talk', summary: 'A quiet place where you can talk feels most comfortable to you.' },
      { key: 'small_activity', title: 'A small activity together', summary: 'A small activity together feels most comfortable to you.' },
      { key: 'chatted_before', title: 'Having chatted a little beforehand', summary: 'You feel more comfortable having chatted a little beforehand.' },
    ],
  },
];

export const CONNECTION_COPY = {
  title: 'How do you like to connect?',
  helper: 'A few optional questions to put your dating preferences into words.',
  inviteCardTitle: 'A summary of your preferences',
  inviteCardBody: 'Based only on the answers you choose.',
  privacy: 'Private: your answers aren’t shown on your profile and aren’t used for matching.',
  privacyShort: 'Private · Not shown on your profile.',
  explore: 'Explore',
  skip: 'Skip for now',
  continue: 'Continue',
  saving: 'Saving…',
  skipQuestion: 'Skip question',
  skipRemaining: 'Skip remaining questions',
  clearAnswer: 'Clear answer',
  saveError: 'Couldn’t save your answer. Check your connection and try again.',
  summaryTitle: 'Your dating preferences',
  summaryHelper: 'A short summary of what you shared.',
  summaryNote: 'Based on your answers, not a personality assessment.',
  editAnswers: 'Edit answers',
  cardTitle: 'Your dating preferences',
  cardStatus: 'Private · Saved',
  view: 'View',
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

export const answeredCount = (a: ConnectionAnswers): number => CONNECTION_QUESTIONS.filter((q) => !!a[q.id]).length;

/** Summary rows for the answered questions only, in question order. */
export function connectionSummary(a: ConnectionAnswers): { id: string; title: string; icon: string; text: string }[] {
  return CONNECTION_QUESTIONS.flatMap((q) => {
    const o = q.options.find((x) => x.key === a[q.id]);
    return o ? [{ id: q.id, title: q.summaryTitle, icon: q.icon, text: o.summary }] : [];
  });
}

/**
 * Stage of the optional interstitial on the live first-submit screen:
 * 'invite' → question 0..n-1 → 'summary' (only with saved answers) → 'done'
 * (the normal submit screen).
 */
export type ConnectStage = 'invite' | number | 'summary' | 'done';

/** End of the questions: the summary when something is saved, else submit. */
export const afterQuestions = (saved: ConnectionAnswers): ConnectStage => (answeredCount(saved) > 0 ? 'summary' : 'done');

export const nextConnectStage = (s: ConnectStage, saved: ConnectionAnswers): ConnectStage =>
  s === 'invite' ? 0 : typeof s === 'number' ? (s + 1 < CONNECTION_QUESTIONS.length ? s + 1 : afterQuestions(saved)) : 'done';

/** Back within the section; the summary opened from the submit screen returns there. */
export const prevConnectStage = (s: ConnectStage, summaryFromSubmit = false): ConnectStage | null =>
  s === 'invite' || s === 'done'
    ? null
    : s === 'summary'
      ? summaryFromSubmit
        ? 'done'
        : CONNECTION_QUESTIONS.length - 1
      : s === 0
        ? 'invite'
        : s - 1;

/**
 * Saves one question's answer (`key`) or removes it (`key === null`) on top
 * of the SERVER-CONFIRMED answers. On failure the confirmed answers are
 * returned unchanged — nothing is shown as saved that wasn't.
 */
export async function commitConnectionAnswer(
  saved: ConnectionAnswers,
  questionId: string,
  key: string | null,
  save: (answers: ConnectionAnswers) => Promise<boolean>,
): Promise<{ ok: boolean; saved: ConnectionAnswers }> {
  const next = { ...saved };
  if (key === null) delete next[questionId];
  else next[questionId] = key;
  const ok = await save(next);
  return ok ? { ok: true, saved: next } : { ok: false, saved };
}
