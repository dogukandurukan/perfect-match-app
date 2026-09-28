// Tempa onboarding V2 — Section 7 Your Profile (P07): approved copy (D58,
// docs/tempa/ONBOARDING_FLOW.md §7) and pure draft logic for the DEV preview.
// Everything here is in memory: photo/selfie values are local device URIs
// chosen by the user, nothing is uploaded, sent, verified or submitted.
// Prompt IDs beyond the two D33 defaults are preview copy, not an approved
// backend enum.
import { parseDob, type BasicsDraft } from '@/lib/onboardingV2/basics';
import { INTERESTS, WORK_OPTIONS, type WorldDraft } from '@/lib/onboardingV2/yourWorld';

export const YOUR_PROFILE_TOTAL_STEPS = 8;

export const PROFILE_STEP = {
  photos: 1,
  prompts: 2,
  preview: 3,
  selfie: 4,
  email: 5,
  code: 6,
  submit: 7,
  received: 8,
} as const;

export const PROFILE_SCREENS: { title: string; helper?: string }[] = [
  { title: 'Add your photos', helper: 'Add at least 3 photos.' },
  { title: 'A little more you', helper: 'Answer 2 questions. Add a third if you like.' },
  { title: 'Your profile', helper: 'This is how others will see you.' },
  { title: 'A quick selfie', helper: "Help us check it's really you." },
  { title: 'Your email', helper: "We'll send you a code." },
  { title: 'Check your email' },
  { title: 'Ready to submit?' },
  { title: "You're on the list" },
];

// ─── Photos ────────────────────────────────────────────────────────────────

export const MIN_PHOTOS = 3;
export const MAX_PHOTOS = 6;

/** A photo the user picked from the device library: local URI only. */
export type LocalPhoto = {
  id: string;
  uri: string;
  width?: number;
  height?: number;
  /** Set when the image failed to load; never counts toward the minimum. */
  broken?: boolean;
};

let photoSeq = 0;
export function newPhotoId(): string {
  photoSeq += 1;
  return `photo-${Date.now().toString(36)}-${photoSeq}`;
}

export function usablePhotos(list: LocalPhoto[]): LocalPhoto[] {
  return list.filter((p) => !!p.uri && !p.broken);
}

/** Adds in order up to the remaining capacity; extra picks are dropped. */
export function addPhotos(list: LocalPhoto[], picked: LocalPhoto[]): LocalPhoto[] {
  const room = MAX_PHOTOS - list.length;
  if (room <= 0) return list;
  return [...list, ...picked.filter((p) => !!p.uri).slice(0, room)];
}

export function removePhoto(list: LocalPhoto[], id: string): LocalPhoto[] {
  return list.filter((p) => p.id !== id);
}

export function replacePhoto(list: LocalPhoto[], id: string, next: LocalPhoto): LocalPhoto[] {
  if (!next.uri) return list;
  return list.map((p) => (p.id === id ? next : p));
}

/** Moves a photo by `delta` slots (−1 earlier, +1 later), clamped. */
export function movePhoto(list: LocalPhoto[], id: string, delta: number): LocalPhoto[] {
  const i = list.findIndex((p) => p.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** The first slot is the main photo. */
export function makeMainPhoto(list: LocalPhoto[], id: string): LocalPhoto[] {
  const p = list.find((x) => x.id === id);
  if (!p) return list;
  return [p, ...list.filter((x) => x.id !== id)];
}

export function markPhotoBroken(list: LocalPhoto[], id: string): LocalPhoto[] {
  return list.map((p) => (p.id === id ? { ...p, broken: true } : p));
}

export function photosValid(list: LocalPhoto[]): boolean {
  const n = usablePhotos(list).length;
  return n >= MIN_PHOTOS && list.length <= MAX_PHOTOS;
}

// ─── Prompts ───────────────────────────────────────────────────────────────

export const ANSWER_MAX_LENGTH = 200;
export const ANSWER_HINT = 'Short answers are welcome.';

export type PromptId =
  | 'most_myself_when'
  | 'talk_for_hours'
  | 'perfect_sunday'
  | 'get_along_if'
  | 'perfect_first_date'
  | 'small_thing_happy';

export const PROMPTS: { id: PromptId; label: string }[] = [
  { id: 'most_myself_when', label: "I'm most myself when…" },
  { id: 'talk_for_hours', label: 'Something I could talk about for hours…' },
  { id: 'perfect_sunday', label: 'My perfect Sunday' },
  { id: 'get_along_if', label: "We'll get along if…" },
  { id: 'perfect_first_date', label: 'A perfect first date looks like…' },
  { id: 'small_thing_happy', label: 'A small thing that makes me happy' },
];

export function promptLabel(id: PromptId): string {
  return PROMPTS.find((p) => p.id === id)?.label ?? '';
}

export type PromptAnswer = { promptId: PromptId; answer: string };

/** D33 defaults, answers always start empty (never autofilled). */
export const DEFAULT_PROMPTS: PromptAnswer[] = [
  { promptId: 'most_myself_when', answer: '' },
  { promptId: 'talk_for_hours', answer: '' },
];

export function answerFilled(a: PromptAnswer): boolean {
  return a.answer.trim().length > 0 && a.answer.length <= ANSWER_MAX_LENGTH;
}

/** Prompts not used by any other slot (the slot's own prompt stays allowed). */
export function availablePrompts(list: PromptAnswer[], slot: number | null): PromptId[] {
  const used = new Set(list.filter((_, i) => i !== slot).map((a) => a.promptId));
  return PROMPTS.map((p) => p.id).filter((id) => !used.has(id));
}

/** Changing a prompt keeps the typed answer unless `clearAnswer` is chosen
 * explicitly; a prompt already used elsewhere is refused. */
export function changePrompt(
  list: PromptAnswer[],
  slot: number,
  promptId: PromptId,
  clearAnswer = false,
): PromptAnswer[] {
  if (!list[slot] || !availablePrompts(list, slot).includes(promptId)) return list;
  return list.map((a, i) => (i === slot ? { promptId, answer: clearAnswer ? '' : a.answer } : a));
}

export function setAnswer(list: PromptAnswer[], slot: number, answer: string): PromptAnswer[] {
  if (!list[slot]) return list;
  return list.map((a, i) => (i === slot ? { ...a, answer: answer.slice(0, ANSWER_MAX_LENGTH) } : a));
}

export function addThirdPrompt(list: PromptAnswer[], promptId: PromptId): PromptAnswer[] {
  if (list.length !== 2 || !availablePrompts(list, null).includes(promptId)) return list;
  return [...list, { promptId, answer: '' }];
}

export function removeThirdPrompt(list: PromptAnswer[]): PromptAnswer[] {
  return list.slice(0, 2);
}

/** Two required answers, unique prompts; an added-but-blank third is simply
 * omitted, a filled third must be within the limit. */
export function promptsValid(list: PromptAnswer[]): boolean {
  if (list.length < 2 || list.length > 3) return false;
  if (new Set(list.map((a) => a.promptId)).size !== list.length) return false;
  if (!answerFilled(list[0]) || !answerFilled(list[1])) return false;
  if (list[2] && list[2].answer.length > ANSWER_MAX_LENGTH) return false;
  return true;
}

/** The answers that appear on the profile (blank optional third dropped). */
export function publicAnswers(list: PromptAnswer[]): PromptAnswer[] {
  return list.filter((a, i) => (i < 2 ? true : a.answer.trim().length > 0)).map((a) => ({
    promptId: a.promptId,
    answer: a.answer.trim(),
  }));
}

// ─── Selfie (private) ──────────────────────────────────────────────────────

/** Front-camera capture kept only as a local URI; never public, never sent. */
export type LocalSelfie = { uri: string };

// ─── Email + demo code (SIMULATED — no email is sent, nothing is verified) ─

export const DEMO_CODE = '123456';
export const RESEND_COOLDOWN_SECONDS = 30;

export function normalizeEmail(v: string): string {
  return v.trim().toLowerCase();
}

/** Reasonable shape only: local@domain.tld, no spaces, one @. */
export function emailLooksValid(v: string): boolean {
  const e = v.trim();
  if (e.length > 254) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(e);
}

/** Demo verification, bound to the exact email it was checked for. Separate
 * from any real auth state. */
export type DemoEmailCheck = { email: string };

/** Seconds left before "Resend code" is available again (simulated). */
export function resendSecondsLeft(sentAt: number | null, now: number): number {
  if (sentAt === null) return 0;
  return Math.max(0, Math.ceil(RESEND_COOLDOWN_SECONDS - (now - sentAt) / 1000));
}

export function demoCodeMatches(code: string): boolean {
  return code === DEMO_CODE;
}

export function emailChecked(email: string, check: DemoEmailCheck | null): boolean {
  return !!check && emailLooksValid(email) && check.email === normalizeEmail(email);
}

/** Keeps only digits, max 6 (handles pasted "123 456" or "Code: 123456"). */
export function sanitizeCode(v: string): string {
  return v.replace(/\D/g, '').slice(0, 6);
}

// ─── Draft ─────────────────────────────────────────────────────────────────

export type ProfileDraft = {
  photos: LocalPhoto[];
  prompts: PromptAnswer[];
  selfie: LocalSelfie | null;
  email: string;
  /** Email the demo code was "sent" to; cleared when the email changes. */
  codeSentTo: string | null;
  /** When the demo code was last "sent" (drives the simulated resend cooldown). */
  codeSentAt: number | null;
  code: string;
  emailCheck: DemoEmailCheck | null;
  /** Local preview marker only — no server, not a real application status. */
  applicationPreview: { receivedAt: number } | null;
};

export const EMPTY_PROFILE_DRAFT: ProfileDraft = {
  photos: [],
  prompts: DEFAULT_PROMPTS,
  selfie: null,
  email: '',
  codeSentTo: null,
  codeSentAt: null,
  code: '',
  emailCheck: null,
  applicationPreview: null,
};

/** Editing the email invalidates the demo code and demo check. */
export function editEmail(d: ProfileDraft, email: string): Partial<ProfileDraft> {
  if (normalizeEmail(email) === normalizeEmail(d.email)) return { email };
  return { email, codeSentTo: null, codeSentAt: null, code: '', emailCheck: null };
}

export type Checklist = { photos: boolean; answers: boolean; selfie: boolean; email: boolean };

export function checklist(d: ProfileDraft): Checklist {
  return {
    photos: photosValid(d.photos),
    answers: promptsValid(d.prompts),
    selfie: !!d.selfie?.uri,
    email: emailChecked(d.email, d.emailCheck),
  };
}

export function canSubmit(d: ProfileDraft): boolean {
  const c = checklist(d);
  return c.photos && c.answers && c.selfie && c.email;
}

/** step is 1-based within Your Profile. The code step is valid only once the
 * demo check matches the current email. */
export function isProfileStepValid(step: number, d: ProfileDraft): boolean {
  switch (step) {
    case PROFILE_STEP.photos:
      return photosValid(d.photos);
    case PROFILE_STEP.prompts:
      return promptsValid(d.prompts);
    case PROFILE_STEP.preview:
      return photosValid(d.photos) && promptsValid(d.prompts);
    case PROFILE_STEP.selfie:
      return !!d.selfie?.uri;
    case PROFILE_STEP.email:
      return emailLooksValid(d.email);
    case PROFILE_STEP.code:
      return emailChecked(d.email, d.emailCheck);
    case PROFILE_STEP.submit:
      return canSubmit(d);
    case PROFILE_STEP.received:
      return d.applicationPreview !== null;
    default:
      return false;
  }
}

// ─── Public profile preview (D44 order) ────────────────────────────────────

export type PreviewFact = { icon: string; text: string };

export type PreviewBlock =
  | { type: 'hero'; photo: LocalPhoto | null; name: string; age: number | null }
  | { type: 'facts'; facts: PreviewFact[]; interests: string[]; favorites: { label: string; items: string[] }[] }
  | { type: 'prompt'; label: string; answer: string }
  | { type: 'photo'; photo: LocalPhoto };

/**
 * Assembles what others would see, from the current drafts only. Excludes
 * surname, exact DOB, email, phone, selfie and anything internal; optional
 * empty fields are omitted. Order: primary photo + first name/age → facts →
 * prompt 1 → photo 2 → prompt 2 → photo 3 → optional prompt 3 → remaining photos.
 */
export function buildProfilePreview(
  basics: BasicsDraft,
  world: WorldDraft,
  profile: ProfileDraft,
): PreviewBlock[] {
  const photos = usablePhotos(profile.photos);
  const answers = publicAnswers(profile.prompts);
  const dob = parseDob(basics.dobDay, basics.dobMonth, basics.dobYear);

  const facts: PreviewFact[] = [];
  if (basics.location) facts.push({ icon: 'location-outline', text: basics.location.city });
  const job = world.jobTitle.trim();
  const work = WORK_OPTIONS.find((w) => w.key === world.workStatus)?.title;
  if (job) facts.push({ icon: 'briefcase-outline', text: job });
  else if (work) facts.push({ icon: 'briefcase-outline', text: work });
  if (world.school) facts.push({ icon: 'school-outline', text: world.school.title });
  if (world.hometown) facts.push({ icon: 'home-outline', text: `From ${world.hometown.title}` });
  const h = Number(basics.heightCm);
  if (/^\d+$/.test(basics.heightCm.trim()) && h > 0) facts.push({ icon: 'resize-outline', text: `${h} cm` });

  const interests = world.interests
    .map((k) => INTERESTS.find((i) => i.key === k)?.label)
    .filter((x): x is string => !!x);
  const favorites = [
    { label: 'Artists', items: world.artists.map((a) => a.title) },
    { label: 'Books', items: world.books.map((b) => b.title) },
    { label: 'Movies & series', items: world.screen.map((s) => s.title) },
  ].filter((f) => f.items.length > 0);

  const blocks: PreviewBlock[] = [
    { type: 'hero', photo: photos[0] ?? null, name: basics.firstName.trim(), age: dob.ok ? dob.age : null },
  ];
  if (facts.length || interests.length || favorites.length) {
    blocks.push({ type: 'facts', facts, interests, favorites });
  }
  const prompt = (i: number) => {
    const a = answers[i];
    if (a && a.answer) blocks.push({ type: 'prompt', label: promptLabel(a.promptId), answer: a.answer });
  };
  const photo = (i: number) => {
    if (photos[i]) blocks.push({ type: 'photo', photo: photos[i] });
  };
  prompt(0);
  photo(1);
  prompt(1);
  photo(2);
  prompt(2);
  for (let i = 3; i < photos.length; i += 1) photo(i);
  return blocks;
}
