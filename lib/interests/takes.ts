// "Your interests" + conversation starters (D87–D97): the small fixed activity
// catalog, the short fixed questions per subject kind and the pure editor
// rules. No backend import (unit checked in
// scripts/onboarding-v2-checks/v2_interests_takes.check.js). Keys must match
// supabase/proposed/20261014090000_v2_interests_takes.sql.
import type { TasteItem } from '@/lib/onboardingV2/yourWorld';

export const MAX_ACTIVITIES = 5;
export const TAKE_MAX = 180;

/** Concrete activities — separate from the 16 broad interests (nothing is
 * derived from those). Ionicons outline glyphs already bundled. */
export const ACTIVITIES: { key: string; label: string; icon: string }[] = [
  { key: 'running', label: 'Running', icon: 'walk-outline' },
  { key: 'walking', label: 'Walking', icon: 'footsteps-outline' },
  { key: 'cycling', label: 'Cycling', icon: 'bicycle-outline' },
  { key: 'hiking', label: 'Hiking', icon: 'trail-sign-outline' },
  { key: 'swimming', label: 'Swimming', icon: 'water-outline' },
  { key: 'gym', label: 'Gym', icon: 'barbell-outline' },
  { key: 'yoga', label: 'Yoga', icon: 'leaf-outline' },
  { key: 'pilates', label: 'Pilates', icon: 'body-outline' },
  { key: 'dancing', label: 'Dancing', icon: 'musical-note-outline' },
  { key: 'cooking', label: 'Cooking', icon: 'restaurant-outline' },
  { key: 'gaming', label: 'Gaming', icon: 'game-controller-outline' },
  { key: 'photography', label: 'Photography', icon: 'camera-outline' },
];
export const activityLabel = (key: string) => ACTIVITIES.find((a) => a.key === key)?.label ?? null;

export type TakeKind = 'activity' | 'book' | 'screen' | 'artist';

export const TAKE_KIND_LABEL: Record<TakeKind, string> = { activity: 'Activity', book: 'Book', screen: 'Film & series', artist: 'Music' };
export const TAKE_KIND_ICON: Record<TakeKind, string> = {
  activity: 'walk-outline',
  book: 'book-outline',
  screen: 'film-outline',
  artist: 'musical-notes-outline',
};

/** Two short, light questions per kind — never an analysis. */
export const TAKE_QUESTIONS: Record<TakeKind, { id: string; text: string }[]> = {
  activity: [
    { id: 'activity_favourite_part', text: 'What’s your favourite part?' },
    { id: 'activity_perfect_day', text: 'What does a perfect one look like?' },
  ],
  book: [
    { id: 'book_why', text: 'Why this book?' },
    { id: 'book_stayed', text: 'What stayed with you?' },
  ],
  screen: [
    { id: 'screen_why', text: 'Why this one?' },
    { id: 'screen_scene', text: 'A scene you’d watch again?' },
  ],
  artist: [
    { id: 'artist_first_song', text: 'Which song should someone start with?' },
    { id: 'artist_when', text: 'When do you listen to them most?' },
  ],
};
/** Display text of a question. Same keys as the server; the stored answer
 * keeps its key. For Running, activity_perfect_day reads "What does your
 * ideal run look like?" (same meaning as the generic "perfect one", D96). */
export function takeQuestionText(id: string, subjectId?: string | null): string | null {
  if (id === 'activity_perfect_day' && subjectId === 'running') return 'What does your ideal run look like?';
  for (const list of Object.values(TAKE_QUESTIONS)) {
    const q = list.find((x) => x.id === id);
    if (q) return q.text;
  }
  return null;
}
/** The questions offered for a subject (Running wording applied). */
export const questionsFor = (s: { kind: TakeKind; id: string }) =>
  TAKE_QUESTIONS[s.kind].map((q) => ({ id: q.id, text: takeQuestionText(q.id, s.id) ?? q.text }));

export const MAX_TAKES = 3;

export type Take = {
  id: string;
  position: number;
  subject_kind: TakeKind;
  subject_id: string;
  subject_title: string;
  question_id: string;
  answer: string;
};

export type Selections = {
  interests: string[];
  activities: string[];
  artists: TasteItem[];
  books: TasteItem[];
  screen: TasteItem[];
};

export type Subject = { kind: TakeKind; id: string; title: string; subtitle?: string };

/** What a take may be about: the user's own SAVED activities, books,
 * movies/series and artists (never the broad interests). */
export function subjectOptions(s: Selections): Subject[] {
  return [
    ...s.activities.map((k) => ({ kind: 'activity' as const, id: k, title: activityLabel(k) ?? k })),
    ...s.books.map((b) => ({ kind: 'book' as const, id: b.id, title: b.title, subtitle: b.subtitle })),
    ...s.screen.map((b) => ({ kind: 'screen' as const, id: b.id, title: b.title, subtitle: b.subtitle })),
    ...s.artists.map((b) => ({ kind: 'artist' as const, id: b.id, title: b.title, subtitle: b.subtitle })),
  ];
}

export const sameSubject = (a: { kind: TakeKind; id: string } | null, t: Pick<Take, 'subject_kind' | 'subject_id'> | null) =>
  !!a && !!t && a.kind === t.subject_kind && a.id === t.subject_id;

/** Stable order: by position (never by edit time). */
export const orderedTakes = (takes: Take[]) => [...takes].sort((a, b) => a.position - b.position);

/** Subjects still free for a take: one take per subject. `editingId` = the
 * take being changed (its own subject stays available to it). */
export function freeSubjects(options: Subject[], takes: Take[], editingId: string | null): Subject[] {
  return options.filter((o) => !takes.some((t) => t.id !== editingId && sameSubject(o, t)));
}

export const canAddTake = (takes: Take[], options: Subject[]) => takes.length < MAX_TAKES && freeSubjects(options, takes, null).length > 0;

/** Takes whose subject these selections would remove (only those). */
export function takesRemovedBy(next: Selections, takes: Take[]): Take[] {
  const opts = subjectOptions(next);
  return orderedTakes(takes).filter((t) => !opts.some((o) => sameSubject(o, t)));
}

// ── Take editor (draft only; server copies stay until a save succeeds) ─────

/** takeId null = a NEW take (never overwrites another). */
export type TakeDraft = { takeId: string | null; subject: Subject | null; questionId: string | null; answer: string; choosing: boolean };

export const newTakeDraft = (): TakeDraft => ({ takeId: null, subject: null, questionId: null, answer: '', choosing: true });

/** Edit the text of a saved take (subject fixed, same id on save). */
export function editTakeDraft(t: Take, options: Subject[]): TakeDraft {
  const subject = options.find((o) => sameSubject(o, t)) ?? { kind: t.subject_kind, id: t.subject_id, title: t.subject_title };
  return { takeId: t.id, subject, questionId: t.question_id, answer: t.answer, choosing: false };
}

/** Change a saved take's subject: nothing carried over until saved. */
export const changeSubjectDraft = (t: Take): TakeDraft => ({ takeId: t.id, subject: null, questionId: null, answer: '', choosing: true });

/** Picking another subject never carries the old answer or question over. */
export function chooseSubject(d: TakeDraft, s: Subject): TakeDraft {
  if (d.subject && d.subject.kind === s.kind && d.subject.id === s.id) return { ...d, choosing: false };
  return { ...d, subject: s, questionId: TAKE_QUESTIONS[s.kind][0].id, answer: '', choosing: false };
}

export function chooseQuestion(d: TakeDraft, id: string): TakeDraft {
  if (!d.subject || !TAKE_QUESTIONS[d.subject.kind].some((q) => q.id === id)) return d;
  return { ...d, questionId: id };
}

export const setAnswer = (d: TakeDraft, text: string): TakeDraft => ({ ...d, answer: text.slice(0, TAKE_MAX) });

export function takeDraftValid(d: TakeDraft): boolean {
  const a = d.answer.trim();
  return !!d.subject && !!d.questionId && TAKE_QUESTIONS[d.subject.kind].some((q) => q.id === d.questionId) && a.length >= 1 && a.length <= TAKE_MAX;
}

export function takeDraftChanged(d: TakeDraft, takes: Take[]): boolean {
  const t = d.takeId ? takes.find((x) => x.id === d.takeId) ?? null : null;
  if (!t) return !!d.subject || d.answer.trim().length > 0;
  return !sameSubject(d.subject, t) || d.questionId !== t.question_id || d.answer.trim() !== t.answer;
}

export const selectionsEqual = (a: Selections, b: Selections) =>
  a.interests.join() === b.interests.join() &&
  a.activities.join() === b.activities.join() &&
  a.artists.map((x) => x.id).join() === b.artists.map((x) => x.id).join() &&
  a.books.map((x) => x.id).join() === b.books.map((x) => x.id).join() &&
  a.screen.map((x) => x.id).join() === b.screen.map((x) => x.id).join();

/** Activities: tapping a selected one removes it; a 6th is refused. */
export function toggleActivity(current: string[], key: string): string[] {
  if (current.includes(key)) return current.filter((k) => k !== key);
  if (current.length >= MAX_ACTIVITIES || !activityLabel(key)) return current;
  return [...current, key];
}

export const SERVER_ERROR_TEXT: Record<string, string> = {
  invalid_interests: 'Pick 1 to 10 interests.',
  invalid_activities: 'Pick up to 5 activities.',
  invalid_taste: 'Something in your books, movies or artists couldn’t be saved. Remove it and try again.',
  invalid_answer: `Write 1 to ${TAKE_MAX} characters.`,
  invalid_question: 'Choose one of the questions.',
  subject_not_selected: 'Save this choice to your interests first.',
  subject_taken: 'You already have a conversation starter about this.',
  limit_reached: `You can have up to 3 conversation starters.`,
  not_found: 'This conversation starter no longer exists. Reload and try again.',
  not_member: 'Your account can’t edit this right now.',
};
