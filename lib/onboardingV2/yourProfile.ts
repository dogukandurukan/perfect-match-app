// Tempa onboarding V2 — Section 7 Your Profile (P07, revised in P07 R1):
// approved copy (D58/D59, docs/tempa/ONBOARDING_FLOW.md §7) and pure draft
// logic for the DEV preview. Everything here is in memory: photo/selfie values
// are local device URIs chosen by the user, nothing is uploaded, sent,
// verified or submitted. Prompt IDs are preview keys, not an approved backend
// enum (Q6).
import { parseDob, type BasicsDraft } from '@/lib/onboardingV2/basics';
import { SINGLE_QUESTIONS, VALUE_OPTIONS, type CompatDraft } from '@/lib/onboardingV2/compatibility';
import { DATE_TYPES, datesSummary, favoriteSpot, type DatesDraft } from '@/lib/onboardingV2/yourDates';
import { HAVE_PETS, type LifeDraft } from '@/lib/onboardingV2/yourLife';
import { INTERESTS, WORK_OPTIONS, type TasteItem, type WorldDraft } from '@/lib/onboardingV2/yourWorld';
import { getZodiacFromDate } from '@/lib/zodiac';
import { promptById } from '@/lib/onboardingV2/promptCatalog';

// P07 R1: the separate "Ready to submit?" checklist state was removed; the
// email-code screen shows "Email confirmed" + Submit application instead.
export const YOUR_PROFILE_TOTAL_STEPS = 7;

export const PROFILE_STEP = {
  photos: 1,
  prompts: 2,
  preview: 3,
  selfie: 4,
  email: 5,
  code: 6,
  received: 7,
} as const;

export const PROFILE_SCREENS: { title: string; helper?: string }[] = [
  { title: 'Add your photos', helper: 'Add at least 3 photos.' },
  { title: 'A little more you', helper: 'Answer 2 questions. Add a third if you like.' },
  { title: 'Your profile', helper: 'This is how others will see you.' },
  { title: 'A quick selfie', helper: "Help us check it's really you." },
  { title: 'Your email', helper: "We'll send you a code." },
  { title: 'Check your email' },
  { title: "You're on the list!" },
];

// ─── Photos ────────────────────────────────────────────────────────────────

export const MIN_PHOTOS = 3;
export const MAX_PHOTOS = 6;

/** A photo the user picked from the device library: local URI only. */
export type LocalPhoto = {
  /** Stable local id — React key and the handle every edit targets. */
  id: string;
  uri: string;
  /** Library asset id when the system provides one (null with limited
   * access / some sources) — only a non-null id is used for de-duplication. */
  assetId?: string | null;
  width?: number;
  height?: number;
  /** Set when the image failed to load; never counts toward the minimum. */
  broken?: boolean;
};

/** Photo edits are applied as functions of the CURRENT list (P07 R2): a
 * late callback (image error, picker return) must never overwrite newer
 * photos with a stale array captured at render time. */
export type PhotoUpdater = (list: LocalPhoto[]) => LocalPhoto[];

let photoSeq = 0;
export function newPhotoId(): string {
  photoSeq += 1;
  return `photo-${Date.now().toString(36)}-${photoSeq}`;
}

export function usablePhotos(list: LocalPhoto[]): LocalPhoto[] {
  return list.filter((p) => !!p.uri && !p.broken);
}

export type AddResult = { list: LocalPhoto[]; added: number; duplicates: number; overflow: number };

/** Appends in pick order after the existing photos, up to the remaining
 * capacity. A pick whose non-null assetId is already present (or repeated
 * in the same batch) is skipped as a duplicate; null asset ids are never
 * treated as equal. Existing photos are never touched. */
export function addPhotosDetailed(list: LocalPhoto[], picked: LocalPhoto[]): AddResult {
  const seen = new Set(list.map((p) => p.assetId).filter((a): a is string => !!a));
  const next = [...list];
  let duplicates = 0;
  let overflow = 0;
  for (const p of picked) {
    if (!p.uri) continue;
    if (p.assetId && seen.has(p.assetId)) {
      duplicates += 1;
      continue;
    }
    if (next.length >= MAX_PHOTOS) {
      overflow += 1;
      continue;
    }
    if (p.assetId) seen.add(p.assetId);
    next.push(p);
  }
  return { list: next, added: next.length - list.length, duplicates, overflow };
}

export function addPhotos(list: LocalPhoto[], picked: LocalPhoto[]): LocalPhoto[] {
  return addPhotosDetailed(list, picked).list;
}

/** Moves a photo to an absolute position (drag-to-reorder); others keep
 * their relative order. Out-of-range targets are clamped. */
export function movePhotoTo(list: LocalPhoto[], id: string, to: number): LocalPhoto[] {
  const from = list.findIndex((p) => p.id === id);
  if (from < 0) return list;
  const target = Math.max(0, Math.min(list.length - 1, to));
  if (target === from) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(target, 0, item);
  return next;
}

export function clearPhotoBroken(list: LocalPhoto[], id: string): LocalPhoto[] {
  return list.map((p) => (p.id === id && p.broken ? { ...p, broken: false } : p));
}

export function removePhoto(list: LocalPhoto[], id: string): LocalPhoto[] {
  return list.filter((p) => p.id !== id);
}

/** Replaces only the target photo, keeping its position. A replacement
 * whose assetId already belongs to ANOTHER photo is refused (duplicate). */
export function replacePhoto(list: LocalPhoto[], id: string, next: LocalPhoto): LocalPhoto[] {
  if (!next.uri || !list.some((p) => p.id === id)) return list;
  if (next.assetId && list.some((p) => p.id !== id && p.assetId === next.assetId)) return list;
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

// ─── Prompts (P07 R2, D60) ─────────────────────────────────────────────────
// Three slots: two required, one optional. Every slot starts EMPTY ("Choose a
// prompt") — no preselected questions, answers never autofilled. Catalog and
// examples: lib/onboardingV2/promptCatalog.ts (examples are help text only).

export const ANSWER_MAX_LENGTH = 200;
export const ANSWER_HINT = 'Short answers are welcome.';
export const PROMPT_SLOTS = 3;
export const REQUIRED_PROMPTS = 2;

export type PromptId = string;
export type PromptAnswer = { promptId: PromptId | null; answer: string };

export const DEFAULT_PROMPTS: PromptAnswer[] = [
  { promptId: null, answer: '' },
  { promptId: null, answer: '' },
  { promptId: null, answer: '' },
];

export function promptLabel(id: PromptId | null): string {
  return promptById(id)?.en ?? '';
}

export function answerFilled(a: PromptAnswer): boolean {
  return !!a.promptId && a.answer.trim().length > 0 && a.answer.length <= ANSWER_MAX_LENGTH;
}

/** Prompt ids chosen in OTHER slots (a slot may keep its own prompt). */
export function usedPromptIds(list: PromptAnswer[], slot: number | null): Set<string> {
  return new Set(
    list.filter((a, i) => i !== slot && a.promptId).map((a) => a.promptId as string),
  );
}

/** Saves a slot from the editor. Refused when the prompt is unknown, already
 * used in another slot, or the answer is blank / over the limit. The answer
 * is stored exactly as typed (no translation, no ASCII folding). */
export function saveSlot(list: PromptAnswer[], slot: number, promptId: PromptId, answer: string): PromptAnswer[] {
  if (slot < 0 || slot >= PROMPT_SLOTS || !promptById(promptId)) return list;
  if (usedPromptIds(list, slot).has(promptId)) return list;
  if (!answer.trim() || answer.length > ANSWER_MAX_LENGTH) return list;
  const next = list.length >= PROMPT_SLOTS ? [...list] : [...list, ...DEFAULT_PROMPTS.slice(list.length)];
  next[slot] = { promptId, answer };
  return next;
}

/** Empties a slot (used for the optional third). */
export function clearSlot(list: PromptAnswer[], slot: number): PromptAnswer[] {
  return list.map((a, i) => (i === slot ? { promptId: null, answer: '' } : a));
}

/** Two filled answers with distinct prompts; the optional third either is
 * empty or valid. A chosen-but-blank slot never counts. */
export function promptsValid(list: PromptAnswer[]): boolean {
  const filled = list.filter(answerFilled);
  if (filled.length < REQUIRED_PROMPTS) return false;
  if (new Set(filled.map((a) => a.promptId)).size !== filled.length) return false;
  return list.every((a) => a.answer.length <= ANSWER_MAX_LENGTH);
}

/** The answers that appear on the profile, in slot order. */
export function publicAnswers(list: PromptAnswer[]): { promptId: PromptId; answer: string }[] {
  return list
    .filter(answerFilled)
    .map((a) => ({ promptId: a.promptId as PromptId, answer: a.answer.trim() }));
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

/** Where Submit sends the user when something required is missing, in flow
 * order; null when everything is complete. */
export function firstMissingStep(d: ProfileDraft): number | null {
  const c = checklist(d);
  if (!c.photos) return PROFILE_STEP.photos;
  if (!c.answers) return PROFILE_STEP.prompts;
  if (!c.selfie) return PROFILE_STEP.selfie;
  if (!c.email) return emailLooksValid(d.email) ? PROFILE_STEP.code : PROFILE_STEP.email;
  return null;
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
    case PROFILE_STEP.received:
      return d.applicationPreview !== null;
    default:
      return false;
  }
}

// ─── Public profile preview (D44 order, all sections — P07 R1) ─────────────

/** One answer line with a small outline icon (Ionicons unless family 'mci'). */
export type PreviewFact = { icon: string; family?: 'ion' | 'mci'; text: string };
/** A titled group of answers; several answers wrap onto the next line. */
export type PreviewGroup = { title: string; items: PreviewFact[] };
export type PreviewTaste = { label: string; kind: 'artist' | 'book' | 'screen'; items: TasteItem[] };

export type PreviewBlock =
  | { type: 'header'; name: string; age: number | null }
  /** Main photo with the first name + age overlaid bottom-left (P07 R1 polish). */
  | { type: 'hero'; photo: LocalPhoto; name: string; age: number | null }
  | { type: 'photo'; photo: LocalPhoto }
  | { type: 'facts'; title?: string; facts: PreviewFact[] }
  | { type: 'groups'; groups: PreviewGroup[] }
  | { type: 'prompt'; label: string; answer: string }
  | { type: 'taste'; groups: PreviewTaste[] };

// Display phrasing for the preview (P07 R1). Keys stay the approved ones;
// these strings are proposed profile copy, not new answers.
const INTENT_TEXT: Record<string, string> = {
  long_term: 'A serious relationship',
  casual: 'Something casual',
  figuring_out: 'Not sure yet',
};
const SMOKING_TEXT: Record<string, string> = { no: "Doesn't smoke", sometimes: 'Smokes sometimes', yes: 'Smokes' };
const DRINKING_TEXT: Record<string, string> = {
  none: "Doesn't drink",
  sometimes: 'Drinks sometimes',
  regularly: 'Drinks regularly',
};
const PET_KIND_TEXT: Record<string, string> = { dog: 'Has a dog', cat: 'Has a cat', both: 'Has a dog and a cat', other: 'Has pets' };
const PETS_TEXT: Record<string, string> = {
  like_no_pets: 'No pets, likes them',
  neutral: 'Neutral about pets',
  rather_not: "Prefers not to live with pets",
};
const ACTIVITY_TEXT: Record<string, string> = { very: 'Very active', somewhat: 'Somewhat active', not_very: 'Not very active' };

function nonEmpty<T>(xs: (T | null | undefined | false | '')[]): T[] {
  return xs.filter((x): x is T => !!x);
}

/**
 * Assembles what others would see, from the current drafts only, as one
 * scrolling profile. Excludes surname, exact DOB, phone, email and the
 * selfie; empty optional fields and empty groups are omitted. Name and age
 * come first (above the main photo) so a tall photo never pushes them away.
 */
export function buildProfilePreview(
  basics: BasicsDraft,
  compat: CompatDraft,
  life: LifeDraft,
  world: WorldDraft,
  dates: DatesDraft,
  profile: ProfileDraft,
): PreviewBlock[] {
  const photos = usablePhotos(profile.photos);
  const answers = publicAnswers(profile.prompts).filter((a) => a.answer);
  const dob = parseDob(basics.dobDay, basics.dobMonth, basics.dobYear);

  // About: city, height, zodiac, work, school, hometown
  const h = Number(basics.heightCm);
  const job = world.jobTitle.trim() || WORK_OPTIONS.find((w) => w.key === world.workStatus)?.title;
  const about: PreviewFact[] = nonEmpty<PreviewFact>([
    basics.location && { icon: 'location-outline', text: basics.location.city },
    /^\d+$/.test(basics.heightCm.trim()) && h > 0 && { icon: 'resize-outline', text: `${h} cm` },
    dob.ok && { icon: 'planet-outline', text: getZodiacFromDate(dob.date).sign },
    job && { icon: 'briefcase-outline', text: job },
    world.school && { icon: 'school-outline', text: world.school.title },
    world.hometown && { icon: 'home-outline', text: `From ${world.hometown.title}` },
  ]);

  // Looking for · values · interests
  const intentQ = SINGLE_QUESTIONS.find((q) => q.id === 'intent');
  const intent = compat.intent && intentQ?.options.some((o) => o.key === compat.intent) ? INTENT_TEXT[compat.intent] : null;
  // Same icons as the answer cards the user picked them from (D51/D56).
  const values: PreviewFact[] = nonEmpty<PreviewFact>(
    compat.values.map((k) => {
      const v = VALUE_OPTIONS.find((o) => o.key === k);
      return v ? { icon: v.icon.name, family: v.icon.family, text: v.label } : null;
    }),
  );
  const interests: PreviewFact[] = nonEmpty<PreviewFact>(
    world.interests.map((k) => {
      const it = INTERESTS.find((i) => i.key === k);
      return it ? { icon: it.icon, text: it.label } : null;
    }),
  );
  const chipGroups: PreviewGroup[] = nonEmpty<PreviewGroup>([
    intent && { title: 'Looking for', items: [{ icon: 'heart-outline', text: intent }] },
    values.length > 0 && { title: 'What matters most', items: values },
    interests.length > 0 && { title: 'Into', items: interests },
  ]);

  // Lifestyle
  const pets =
    life.pets === HAVE_PETS ? PET_KIND_TEXT[life.petKind ?? 'other'] : life.pets ? PETS_TEXT[life.pets] : null;
  const lifestyle: PreviewFact[] = nonEmpty<PreviewFact>([
    life.smoking && SMOKING_TEXT[life.smoking] && { icon: 'leaf-outline', text: SMOKING_TEXT[life.smoking] },
    life.drinking && DRINKING_TEXT[life.drinking] && { icon: 'wine-outline', text: DRINKING_TEXT[life.drinking] },
    pets && { icon: 'paw-outline', text: pets },
    life.activity && ACTIVITY_TEXT[life.activity] && { icon: 'bicycle-outline', text: ACTIVITY_TEXT[life.activity] },
  ]);

  // First dates
  const types = dates.dateTypes
    .map((k) => DATE_TYPES.find((t) => t.key === k)?.label)
    .filter((x): x is string => !!x);
  const when = datesSummary(dates);
  const spot = favoriteSpot(dates);
  const firstDates: PreviewFact[] = nonEmpty<PreviewFact>([
    types.length > 0 && { icon: 'cafe-outline', text: types.join(' · ') },
    when && { icon: 'calendar-outline', text: when },
    spot && { icon: 'star-outline', text: `Favorite spot: ${spot.displayName}` },
  ]);

  // Favorites (titles/metadata from the chosen catalog items only)
  const taste: PreviewTaste[] = nonEmpty<PreviewTaste>([
    world.artists.length > 0 && { label: 'Artists', kind: 'artist', items: world.artists },
    world.books.length > 0 && { label: 'Books', kind: 'book', items: world.books },
    world.screen.length > 0 && { label: 'Movies & series', kind: 'screen', items: world.screen },
  ]);

  // Content sections, interleaved with photos 2… and prompts.
  const sections: PreviewBlock[] = nonEmpty<PreviewBlock>([
    about.length > 0 && { type: 'facts', facts: about },
    chipGroups.length > 0 && { type: 'groups', groups: chipGroups },
    lifestyle.length > 0 && { type: 'facts', title: 'Lifestyle', facts: lifestyle },
    firstDates.length > 0 && { type: 'facts', title: 'First dates', facts: firstDates },
    taste.length > 0 && { type: 'taste', groups: taste },
  ]);
  const prompts: PreviewBlock[] = answers.map((a) => ({ type: 'prompt', label: promptLabel(a.promptId), answer: a.answer }));

  // Name + age live on the main photo (no separate line, not repeated);
  // only if there is no usable photo does a plain header stand in.
  const name = basics.firstName.trim();
  const age = dob.ok ? dob.age : null;
  const blocks: PreviewBlock[] = photos[0]
    ? [{ type: 'hero', photo: photos[0], name, age }]
    : [{ type: 'header', name, age }];
  // Rhythm: info → prompt → photo, repeated; leftovers keep their order.
  const rest = photos.slice(1);
  const n = Math.max(sections.length, prompts.length, rest.length);
  for (let i = 0; i < n; i += 1) {
    if (sections[i]) blocks.push(sections[i]);
    if (prompts[i]) blocks.push(prompts[i]);
    if (rest[i]) blocks.push({ type: 'photo', photo: rest[i] });
  }
  return blocks;
}
