// "What you're looking for" — intention, priorities and connection style,
// shown before the first submit (D104b, owner 2026-10-25). Pure.
//
// Version 3 (new meanings, new stable ids). Version-1 and version-2 answers
// stay on the server untouched and are never read, summarised or converted.
// Only stable ids are stored; texts below are display copy.
//
// • Intention: asked ONCE. While this section is on (and the server has the
//   package), the old Compatibility "What are you looking for?" step is
//   hidden; the new main intention is required for people who have no old
//   intent (server completeness accepts either — never mapped between them).
//   Private in this version: not shown on the profile.
// • Priorities and connection style: optional, private, not used for matching.
// • No personality labels, attachment styles, scores or compatibility. The
//   summary is fixed text per option.
// • What someone WANTS in another person is kept apart from facts about
//   themself ("Lives alone" here never means the user lives alone).

/** The single on/off setting for this section. false → no invite, questions,
 * summary or submit-screen card; the old Compatibility intent step shows
 * again and the normal submit continues. Saved answers are kept. */
export const CONNECTION_ENABLED = true;

export const CONNECTION_VERSION = 3;

// ─── Intention ──────────────────────────────────────────────────────────────
export type IntentKey = 'one_night' | 'casual' | 'see_where' | 'long_term' | 'marriage' | 'figuring_out';
export const INTENTS: { key: IntentKey; title: string; summary: string; phrase: string }[] = [
  { key: 'one_night', title: 'A one-night connection', summary: 'A one-night connection.', phrase: 'a one-night connection' },
  { key: 'casual', title: 'Casual dating, without commitment', summary: 'Casual dating, without commitment.', phrase: 'casual dating, without commitment' },
  { key: 'see_where', title: 'Seeing where things go', summary: 'Seeing where things go.', phrase: 'seeing where things go' },
  { key: 'long_term', title: 'A long-term relationship', summary: 'A long-term relationship.', phrase: 'a long-term relationship' },
  { key: 'marriage', title: 'A relationship leading to marriage', summary: 'A relationship leading to marriage.', phrase: 'a relationship leading to marriage' },
  { key: 'figuring_out', title: 'Still figuring it out', summary: 'Still figuring it out.', phrase: '' },
];
/** "Also open to…": concrete intentions only — never "Still figuring it out". */
export const ALSO_OPEN_KEYS: IntentKey[] = ['one_night', 'casual', 'see_where', 'long_term', 'marriage'];

// ─── Priorities (what the user wants in ANOTHER person) ─────────────────────
export type Importance = 'preference' | 'must_have';
export type PriorityTopicKey = 'active' | 'interests' | 'education' | 'career' | 'money' | 'living' | 'children';
export type PriorityTopic = {
  key: PriorityTopicKey;
  title: string;
  /** multi = checkboxes; single = one choice; interests = up to 3 of the user's own interests. */
  mode: 'multi' | 'single' | 'interests';
  details: { key: string; title: string }[];
};
export const MAX_PRIORITIES = 3;
export const MAX_SHARED_INTERESTS = 3;
export const PRIORITY_TOPICS: PriorityTopic[] = [
  { key: 'active', title: 'Active lifestyle', mode: 'multi', details: [
    { key: 'exercises', title: 'Exercises regularly' },
    { key: 'active_together', title: 'Enjoys being active together' },
  ] },
  { key: 'interests', title: 'Shared interests', mode: 'interests', details: [] },
  { key: 'education', title: 'Education', mode: 'multi', details: [{ key: 'degree', title: 'Has a university degree' }] },
  { key: 'career', title: 'Work & career', mode: 'multi', details: [
    { key: 'steady_job', title: 'Has a steady job' },
    { key: 'values_career', title: 'Values their career' },
  ] },
  { key: 'money', title: 'Money mindset', mode: 'multi', details: [
    { key: 'independent', title: 'Is financially independent' },
    { key: 'similar_spending', title: 'Has a similar approach to spending and saving' },
  ] },
  { key: 'living', title: 'Living arrangements', mode: 'multi', details: [
    { key: 'lives_alone', title: 'Lives alone' },
    { key: 'similar_routine', title: 'Has a similar daily routine' },
  ] },
  { key: 'children', title: 'Plans for children', mode: 'single', details: [
    { key: 'wants', title: 'Wants children in the future' },
    { key: 'does_not_want', title: 'Does not want children' },
    { key: 'deciding', title: 'Is still deciding' },
  ] },
];
export const IMPORTANCE_LABEL: Record<Importance, string> = { preference: 'Preference', must_have: 'Must-have' };

// ─── Connection style ───────────────────────────────────────────────────────
export const MAX_CONNECTION = 2;
export const CONNECTION_OPTIONS: { key: string; title: string; phrase: string }[] = [
  { key: 'regular_contact', title: 'Regular contact and clear mutual interest', phrase: 'regular contact and clear mutual interest' },
  { key: 'gradual', title: 'Letting closeness grow gradually', phrase: 'letting closeness grow gradually' },
  { key: 'own_space', title: 'Keeping time and space for myself', phrase: 'keeping time and space for yourself' },
  { key: 'open_talk', title: 'Talking openly about expectations', phrase: 'talking openly about expectations' },
  { key: 'own_rhythm', title: 'Finding our own rhythm together', phrase: 'finding your own rhythm together' },
  { key: 'not_sure', title: 'I’m not sure yet', phrase: '' },
];
export const NOT_SURE = 'not_sure';

export type ConnectionAnswers = {
  intent?: IntentKey;
  intent_also?: IntentKey[];
  priorities_none?: true;
  priorities?: Partial<Record<PriorityTopicKey, Record<string, Importance>>>;
  connection?: string[];
};
export type Priorities = NonNullable<ConnectionAnswers['priorities']>;

export const CONNECTION_COPY = {
  inviteTitle: 'What you’re looking for',
  inviteHelper: 'Three short questions: what you’re looking for, what matters to you and how you like to connect.',
  inviteCardTitle: 'A summary in your own words',
  inviteCardBody: 'Based only on the answers you choose.',
  // The real behaviour, per field (nothing here is used for matching today).
  inviteRequired: 'Choosing what you’re looking for is needed for your application.',
  privacy: 'Your answers are saved privately. They aren’t shown on your profile and aren’t used for matching yet.',
  privacyShort: 'Private · Not shown on your profile.',
  explore: 'Explore',
  skip: 'Skip for now',
  continue: 'Continue',
  seeSummary: 'See my summary',
  saving: 'Saving…',
  skipQuestion: 'Skip question',
  clearAnswer: 'Clear answer',
  noPreferences: 'No specific preferences',
  noPreferencesConfirmTitle: 'No specific preferences?',
  noPreferencesConfirmBody: 'This clears the priorities you chose on this screen.',
  noPreferencesConfirm: 'Clear and continue',
  cancel: 'Cancel',
  saveError: 'Couldn’t save your answer. Check your connection and try again.',
  intentTitle: 'What are you looking for?',
  intentHelper: 'Choose what fits you best right now.',
  alsoOpen: 'Also open to…',
  alsoOpenHelper: 'Optional. Choose any that also fit.',
  prioritiesTitle: 'What matters to you?',
  prioritiesHelper: 'Choose up to 3 priorities.',
  detailNeeded: 'Choose at least one detail.',
  detailNeededFor: (topic: string) => `Choose at least one detail for ${topic}.`,
  show: 'Show',
  sharedInterestsHelper: 'Choose up to 3 of your interests.',
  connectionTitle: 'How do you like to connect?',
  connectionHelper: 'Choose up to 2 that feel right for you.',
  summaryTitle: 'What you’re looking for',
  summaryHelper: 'Based on the preferences you shared.',
  summaryIntent: 'Your intention',
  summaryMatters: 'What matters to you in a partner',
  summaryStyle: 'Your connection style',
  summaryNote: 'These preferences aren’t a personality assessment.',
  continueToApplication: 'Continue to application',
  editPreferences: 'Edit preferences',
  cardTitle: 'What you’re looking for',
  cardStatus: 'Private · Saved',
  view: 'View',
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const intentKeys = INTENTS.map((i) => i.key) as string[];

/** Keeps only valid, known data (mirrors the server rules); anything else is dropped. */
export function cleanConnectionAnswers(raw: unknown, interestKeys: string[]): ConnectionAnswers {
  const out: ConnectionAnswers = {};
  if (!isObj(raw)) return out;
  if (typeof raw.intent === 'string' && intentKeys.includes(raw.intent)) out.intent = raw.intent as IntentKey;
  if (out.intent && Array.isArray(raw.intent_also)) {
    const also = [...new Set(raw.intent_also.filter((k): k is IntentKey => typeof k === 'string' && (ALSO_OPEN_KEYS as string[]).includes(k) && k !== out.intent))];
    if (also.length) out.intent_also = also;
  }
  if (raw.priorities_none === true) out.priorities_none = true;
  else if (isObj(raw.priorities)) {
    const p: Priorities = {};
    for (const t of PRIORITY_TOPICS) {
      const d = raw.priorities[t.key];
      if (!isObj(d)) continue;
      const allowed = t.mode === 'interests' ? interestKeys : t.details.map((x) => x.key);
      const keep = Object.entries(d).filter(([k, v]) => allowed.includes(k) && (v === 'preference' || v === 'must_have'));
      const limited = t.mode === 'single' ? keep.slice(0, 1) : t.mode === 'interests' ? keep.slice(0, MAX_SHARED_INTERESTS) : keep;
      if (limited.length) p[t.key] = Object.fromEntries(limited) as Record<string, Importance>;
      if (Object.keys(p).length >= MAX_PRIORITIES) break;
    }
    if (Object.keys(p).length) out.priorities = p;
  }
  if (Array.isArray(raw.connection)) {
    const keys = CONNECTION_OPTIONS.map((o) => o.key);
    const c = [...new Set(raw.connection.filter((k): k is string => typeof k === 'string' && keys.includes(k)))];
    const ok = c.includes(NOT_SURE) ? (c.length === 1 ? c : []) : c.slice(0, MAX_CONNECTION);
    if (ok.length) out.connection = ok;
  }
  return out;
}

export const hasAnyAnswer = (a: ConnectionAnswers): boolean =>
  !!a.intent || !!a.priorities_none || !!(a.priorities && Object.keys(a.priorities).length) || !!a.connection?.length;

// ─── Intention edits ────────────────────────────────────────────────────────
/** A new main intention removes itself from "Also open to"; the rest is kept. */
export function setPrimaryIntent(also: IntentKey[], key: IntentKey): { intent: IntentKey; also: IntentKey[] } {
  return { intent: key, also: also.filter((k) => k !== key) };
}
export function toggleAlsoOpen(also: IntentKey[], key: IntentKey, primary: IntentKey | undefined): IntentKey[] {
  if (key === primary || !ALSO_OPEN_KEYS.includes(key)) return also;
  return also.includes(key) ? also.filter((k) => k !== key) : [...also, key];
}

// ─── Priority edits ─────────────────────────────────────────────────────────
export const topicOf = (key: PriorityTopicKey): PriorityTopic => PRIORITY_TOPICS.find((t) => t.key === key)!;
/** Up to 3 topics; removing a topic removes its details and importance too. */
export function toggleTopic(p: Priorities, key: PriorityTopicKey): Priorities {
  const next = { ...p };
  if (next[key]) {
    delete next[key];
    return next;
  }
  if (Object.keys(next).length >= MAX_PRIORITIES) return p;
  next[key] = {};
  return next;
}
export function toggleDetail(p: Priorities, key: PriorityTopicKey, detail: string): Priorities {
  const t = topicOf(key);
  const cur = p[key];
  if (!cur) return p;
  if (cur[detail]) {
    const d = { ...cur };
    delete d[detail];
    return { ...p, [key]: d };
  }
  if (t.mode === 'single') return { ...p, [key]: { [detail]: 'preference' } };
  if (t.mode === 'interests' && Object.keys(cur).length >= MAX_SHARED_INTERESTS) return p;
  return { ...p, [key]: { ...cur, [detail]: 'preference' } };
}
export function setImportance(p: Priorities, key: PriorityTopicKey, detail: string, imp: Importance): Priorities {
  const cur = p[key];
  if (!cur || !cur[detail]) return p;
  return { ...p, [key]: { ...cur, [detail]: imp } };
}
/** The first chosen topic (screen order) that still has no detail. */
export const firstIncompleteTopic = (p: Priorities): PriorityTopicKey | null =>
  PRIORITY_TOPICS.find((t) => !!p[t.key] && Object.keys(p[t.key] ?? {}).length === 0)?.key ?? null;

/** At least one topic and every chosen topic has at least one detail. */
export const prioritiesComplete = (p: Priorities): boolean =>
  Object.keys(p).length > 0 && Object.values(p).every((d) => !!d && Object.keys(d).length > 0);

// ─── Connection edits ───────────────────────────────────────────────────────
/** Up to 2; "I'm not sure yet" never together with another option. */
export function toggleConnection(list: string[], key: string): string[] {
  if (list.includes(key)) return list.filter((k) => k !== key);
  if (key === NOT_SURE) return [NOT_SURE];
  const rest = list.filter((k) => k !== NOT_SURE);
  return rest.length >= MAX_CONNECTION ? list : [...rest, key];
}

// ─── Summary (fixed text only) ──────────────────────────────────────────────
const joinAnd = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function intentSummary(a: ConnectionAnswers): { main: string; also: string | null } | null {
  const main = INTENTS.find((i) => i.key === a.intent);
  if (!main) return null;
  const also = (a.intent_also ?? []).map((k) => INTENTS.find((i) => i.key === k)?.phrase).filter((x): x is string => !!x);
  return { main: main.summary, also: also.length ? `Also open to ${joinAnd(also)}.` : null };
}

export type PrioritySummaryRow = { topic: string; details: { title: string; importance: string }[] };
export function prioritiesSummary(a: ConnectionAnswers, interestLabel: (key: string) => string | undefined): PrioritySummaryRow[] | 'none' | null {
  if (a.priorities_none) return 'none';
  if (!a.priorities) return null;
  const rows = PRIORITY_TOPICS.flatMap((t) => {
    const d = a.priorities?.[t.key];
    if (!d || !Object.keys(d).length) return [];
    const details = Object.entries(d).flatMap(([k, imp]) => {
      const title = t.mode === 'interests' ? interestLabel(k) : t.details.find((x) => x.key === k)?.title;
      return title ? [{ title, importance: IMPORTANCE_LABEL[imp] }] : [];
    });
    return details.length ? [{ topic: t.title, details }] : [];
  });
  return rows.length ? rows : null;
}

export function connectionStyleSummary(a: ConnectionAnswers): string | null {
  const c = a.connection ?? [];
  if (!c.length) return null;
  if (c.includes(NOT_SURE)) return 'Not sure yet.';
  const phrases = c.map((k) => CONNECTION_OPTIONS.find((o) => o.key === k)?.phrase).filter((x): x is string => !!x);
  return phrases.length ? `${cap(joinAnd(phrases))}.` : null;
}

// ─── Stages ─────────────────────────────────────────────────────────────────
/**
 * 'invite' → 0 intention → 1 priorities → 2 connection style → 'summary'
 * (only with saved answers) → 'done' (the normal submit screen).
 */
export type ConnectStage = 'invite' | 0 | 1 | 2 | 'summary' | 'done';
export const QUESTION_COUNT = 3;

export const afterQuestions = (saved: ConnectionAnswers): ConnectStage => (hasAnyAnswer(saved) ? 'summary' : 'done');

export const nextConnectStage = (s: ConnectStage, saved: ConnectionAnswers): ConnectStage =>
  s === 'invite' ? 0 : s === 0 ? 1 : s === 1 ? 2 : s === 2 ? afterQuestions(saved) : 'done';

export const prevConnectStage = (s: ConnectStage, summaryFromSubmit = false): ConnectStage | null =>
  s === 'invite' || s === 'done' ? null : s === 'summary' ? (summaryFromSubmit ? 'done' : 2) : s === 0 ? 'invite' : ((s - 1) as ConnectStage);

/** Where the section opens: saved answers → straight to the submit screen (View/Edit there). */
export const initialConnectStage = (saved: ConnectionAnswers): ConnectStage => (hasAnyAnswer(saved) ? 'done' : 'invite');

/**
 * Applies `edit` to the SERVER-CONFIRMED answers and saves. On failure the
 * confirmed answers come back unchanged — nothing is shown as saved that wasn't.
 */
export async function commitConnection(
  saved: ConnectionAnswers,
  edit: (a: ConnectionAnswers) => ConnectionAnswers,
  save: (answers: ConnectionAnswers) => Promise<boolean>,
): Promise<{ ok: boolean; saved: ConnectionAnswers }> {
  const next = edit({ ...saved });
  const ok = await save(next);
  return ok ? { ok: true, saved: next } : { ok: false, saved };
}

/** Stage edits: each question replaces only its own part. */
export const withIntent = (intent: IntentKey | undefined, also: IntentKey[]) => (a: ConnectionAnswers): ConnectionAnswers => {
  const n = { ...a };
  delete n.intent;
  delete n.intent_also;
  if (intent) n.intent = intent;
  if (intent && also.length) n.intent_also = also.filter((k) => k !== intent);
  return n;
};
export const withPriorities = (p: Priorities | null, none = false) => (a: ConnectionAnswers): ConnectionAnswers => {
  const n = { ...a };
  delete n.priorities;
  delete n.priorities_none;
  if (none) n.priorities_none = true;
  else if (p && Object.keys(p).length) n.priorities = p;
  return n;
};
export const withConnection = (c: string[]) => (a: ConnectionAnswers): ConnectionAnswers => {
  const n = { ...a };
  delete n.connection;
  if (c.length) n.connection = c;
  return n;
};
