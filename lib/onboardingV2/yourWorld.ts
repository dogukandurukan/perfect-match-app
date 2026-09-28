// Tempa onboarding V2 — Section 5 Your World (P05): approved copy (D54/D55,
// docs/tempa/ONBOARDING_FLOW.md §5) and pure draft logic. Keys are local
// preview keys only; nothing here approves a backend schema or scoring.
import { foldTr } from '@/lib/onboardingV2/locationCatalog';

export const YOUR_WORLD_TOTAL_STEPS = 6;

export const WORLD_SCREENS: { title: string; helper?: string }[] = [
  { title: 'What do you do?' },
  { title: 'Where did you study?', helper: 'Add your school to your profile.' },
  { title: 'Where are you from?', helper: 'Your hometown, not where you live now.' },
  { title: 'What are you into?', helper: 'Pick 3–10 interests.' },
  { title: 'Who do you listen to?', helper: 'Add up to 3 artists you love.' },
  { title: 'Books & movies', helper: 'Add a few favorites. You can change them later.' },
];

export const WORK_OPTIONS: { key: string; title: string }[] = [
  { key: 'full_time', title: 'Full-time' },
  { key: 'part_time', title: 'Part-time' },
  { key: 'self_employed', title: 'Self-employed' },
  { key: 'student', title: 'Student' },
  { key: 'between_jobs', title: 'Between jobs' },
];

// Small single-colour outline icon left of each label (owner choice
// 2026-09-27, D56) — Ionicons glyphs already bundled; no emojis.
export const INTERESTS: { key: string; label: string; icon: string }[] = (
  [
    ['Travel', 'airplane-outline'],
    ['Food', 'restaurant-outline'],
    ['Sports', 'football-outline'],
    ['Music', 'musical-notes-outline'],
    ['Art', 'color-palette-outline'],
    ['Movies', 'film-outline'],
    ['Books', 'book-outline'],
    ['Outdoors', 'trail-sign-outline'],
    ['Tech', 'hardware-chip-outline'],
    ['Gaming', 'game-controller-outline'],
    ['Fashion', 'shirt-outline'],
    ['Wellness', 'flower-outline'],
    ['Animals', 'paw-outline'],
    ['Nightlife', 'moon-outline'],
    ['Culture', 'library-outline'],
    ['Other', 'ellipsis-horizontal-circle-outline'],
  ] as [string, string][]
).map(([label, icon]) => ({ key: label.toLowerCase(), label, icon }));

export const MIN_INTERESTS = 3;
export const MAX_INTERESTS = 10;
export const MAX_TASTE = 3;

export type TasteKind = 'school' | 'hometown' | 'artist' | 'book' | 'screen';

/** A selected search result or an explicit custom entry. `source` records
 * provenance; `id` is the stable source ID (or `custom:<folded text>`). */
export type TasteItem = {
  kind: TasteKind;
  /** Provenance: live catalog, bundled sample (schools/hometown) or typed. */
  source: 'musicbrainz' | 'openlibrary' | 'wikidata' | 'sample' | 'custom';
  id: string;
  title: string;
  /** Verified extra line only (author, "2005 · Movie", "İstanbul, Turkey"). */
  subtitle?: string;
  /** Only when the provider supplies and permits it (Open Library covers). */
  imageUrl?: string;
};

export type WorldDraft = {
  workStatus: string | null;
  jobTitle: string;
  school: TasteItem | null;
  hometown: TasteItem | null;
  interests: string[];
  artists: TasteItem[];
  books: TasteItem[];
  screen: TasteItem[];
};

export const EMPTY_WORLD_DRAFT: WorldDraft = {
  workStatus: null,
  jobTitle: '',
  school: null,
  hometown: null,
  interests: [],
  artists: [],
  books: [],
  screen: [],
};

/** Explicit "Use “typed text”" entry — exact text kept, custom provenance. */
export function customItem(kind: TasteKind, text: string): TasteItem | null {
  const title = text.trim().replace(/\s+/g, ' ');
  if (title.length < 2) return null;
  return { kind, source: 'custom', id: `custom:${kind}:${foldTr(title)}`, title };
}

export type AddResult = { list: TasteItem[]; rejected?: 'duplicate' | 'full' };

/** Add to a 0–3 list. Same source ID (incl. exact normalized custom text) is
 * rejected as a duplicate; a 4th is refused. Nothing is merged fuzzily. */
export function addTaste(list: TasteItem[], item: TasteItem, max = MAX_TASTE): AddResult {
  if (list.some((x) => x.id === item.id)) return { list, rejected: 'duplicate' };
  if (list.length >= max) return { list, rejected: 'full' };
  return { list: [...list, item] };
}

export function removeTaste(list: TasteItem[], id: string): TasteItem[] {
  return list.filter((x) => x.id !== id);
}

/** Interests: tapping selected deselects; an 11th is refused, never replaces. */
export function toggleInterest(current: string[], key: string): string[] {
  if (current.includes(key)) return current.filter((k) => k !== key);
  if (current.length >= MAX_INTERESTS) return current;
  return [...current, key];
}

/** step is 1-based within Your World. Only interests (4) is required. */
export function isWorldStepValid(step: number, d: WorldDraft): boolean {
  if (step === 4) return d.interests.length >= MIN_INTERESTS && d.interests.length <= MAX_INTERESTS;
  return step >= 1 && step <= YOUR_WORLD_TOTAL_STEPS;
}

/** Screens with an "Add later" skip (everything except interests). */
export function isWorldStepSkippable(step: number): boolean {
  return step !== 4 && step >= 1 && step <= YOUR_WORLD_TOTAL_STEPS;
}
