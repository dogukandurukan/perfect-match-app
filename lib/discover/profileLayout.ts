// Discover full profile (approved design, 2026-10-08): the top-to-bottom
// profile order, personal details, location rule and screen-chrome rules —
// shared by the real V2 Discover (components/main/V2DiscoverScreen.tsx) and
// the DEV design preview (lib/dev/discoverPreview.ts, local fixtures). Pure
// module: no backend, no React Native.
import {
  buildPublicProfileBlocks,
  promptLabel,
  type PreviewFact,
  type PreviewGroup,
  type PreviewTaste,
  type PublicProfileInput,
} from '@/lib/onboardingV2/yourProfile';
import { WORK_OPTIONS } from '@/lib/onboardingV2/yourWorld';

/** Same limit as likes.note on the server. */
export const COMMENT_MAX = 240;

export type DiscoverPerson = Omit<PublicProfileInput, 'photos' | 'prompts'> & {
  id: string;
  /** Only set when the person chose to share it. The real Discover never
   * has one yet (no explicit share choice exists; a filled district is not
   * consent) — so the city is shown. */
  district: string | null;
  photoCount: number;
  /** Real profiles: stable server ids (profile_photos_v2.id), in order. */
  photoIds?: string[];
  /** Real profiles carry the stable profile_prompts_v2.id. */
  prompts: { promptId: string; answer: string; id?: string }[];
};

/** Content targets: `photo:<id>` / `prompt:<id>`. With server ids these are
 * the stable row ids; the DEV preview (no ids) falls back to local keys. */
export const photoKey = (i: number) => `photo:${i}`;
export const promptKey = (promptId: string) => `prompt:${promptId}`;
export function photoTarget(p: Pick<DiscoverPerson, 'photoIds'>, i: number): string {
  const id = p.photoIds?.[i];
  return id ? `photo:${id}` : photoKey(i);
}
export function promptTarget(a: { promptId: string; id?: string }): string {
  return a.id ? `prompt:${a.id}` : promptKey(a.promptId);
}
/** Server form of a target, or null if it isn't a stable id. */
export function parseTarget(target: string): { type: 'photo' | 'prompt'; id: string } | null {
  const m = /^(photo|prompt):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.exec(target);
  return m ? { type: m[1] as 'photo' | 'prompt', id: m[2].toLowerCase() } : null;
}

// ─── Profile order ─────────────────────────────────────────────────────────

/** A labelled personal detail ("Hometown" / "İzmir"). `wide` = its own
 * full-width row (Job, School: long values would wrap badly in a column). */
export type LabelledFact = { icon: string; label: string; value: string; wide?: boolean };

export type DiscoverItem =
  | { type: 'hero'; photoIndex: 0; target: string; name: string; age: number | null; location: string | null }
  | { type: 'prompt'; key: string; label: string; answer: string }
  | { type: 'details'; facts: LabelledFact[] }
  | { type: 'photo'; photoIndex: number; target: string }
  | { type: 'groups'; groups: PreviewGroup[] }
  | { type: 'taste'; groups: PreviewTaste[] }
  | { type: 'firstDate'; facts: PreviewFact[] };

/** District when shared, otherwise the city. Never coordinates. */
export function heroLocation(p: Pick<DiscoverPerson, 'district' | 'city'>): string | null {
  return p.district?.trim() || p.city?.trim() || null;
}

/** About: Height + Zodiac (short, side by side), then Hometown, Job and
 * School as full-width rows. The location is on the hero, so it is not
 * repeated here. Empty fields are left out. */
export function personalDetails(p: DiscoverPerson): LabelledFact[] {
  const job = p.jobTitle.trim() || WORK_OPTIONS.find((w) => w.key === p.workStatus)?.title || '';
  const out: (LabelledFact | null)[] = [
    p.heightCm ? { icon: 'resize-outline', label: 'Height', value: `${p.heightCm} cm` } : null,
    p.zodiac ? { icon: 'planet-outline', label: 'Zodiac', value: p.zodiac } : null,
    p.hometown ? { icon: 'home-outline', label: 'Hometown', value: p.hometown.title, wide: true } : null,
    job ? { icon: 'briefcase-outline', label: 'Job', value: job, wide: true } : null,
    p.school ? { icon: 'school-outline', label: 'School', value: p.school.title, wide: true } : null,
  ];
  return out.filter((x): x is LabelledFact => !!x);
}


/**
 * The starting top-to-bottom order for phone review (not final):
 * hero → prompt 1 → details → photo 2 → Looking for + values → prompt 2 →
 * photo 3 → interests + lifestyle → favourites → leftover photos / prompt 3
 * spread between the long sections → first dates.
 * Section contents and wording come from the shared public-profile builder,
 * so meanings match the approved own-profile preview.
 */
export function buildDiscoverLayout(p: DiscoverPerson): DiscoverItem[] {
  const shared = buildPublicProfileBlocks({
    ...p,
    prompts: p.prompts.map((a) => ({ promptId: a.promptId, answer: a.answer })),
    photos: Array.from({ length: p.photoCount }, (_, i) => ({ id: `${p.id}-${i}`, uri: `local:${i}` })),
  });
  const groups = shared.find((b) => b.type === 'groups');
  const allGroups = groups && groups.type === 'groups' ? groups.groups : [];
  const titled = (title: string) => shared.find((b) => b.type === 'facts' && b.title === title);
  const lifestyle = titled('Lifestyle');
  const firstDates = titled('First dates');
  const taste = shared.find((b) => b.type === 'taste');

  const prompts = p.prompts
    .filter((a) => a.answer.trim())
    .map((a) => ({ type: 'prompt' as const, key: promptTarget(a), label: promptLabel(a.promptId), answer: a.answer }));
  const photo = (i: number): DiscoverItem | null => (i < p.photoCount ? { type: 'photo', photoIndex: i, target: photoTarget(p, i) } : null);

  const lookingFor = allGroups.filter((g) => g.title === 'Looking for' || g.title === 'What matters most');
  const interestsLife: PreviewGroup[] = [
    ...allGroups.filter((g) => g.title === 'Into'),
    ...(lifestyle && lifestyle.type === 'facts' ? [{ title: 'Lifestyle', items: lifestyle.facts }] : []),
  ];
  const details = personalDetails(p);

  const head: (DiscoverItem | null)[] = [
    { type: 'hero', photoIndex: 0, target: photoTarget(p, 0), name: p.name, age: p.age, location: heroLocation(p) },
    prompts[0] ?? null,
    details.length ? { type: 'details', facts: details } : null,
    photo(1),
    lookingFor.length ? { type: 'groups', groups: lookingFor } : null,
    prompts[1] ?? null,
    photo(2),
  ];

  // Long sections, then leftover photos and the third+ prompts spread evenly
  // between them (prompt 3 goes second so two photos rarely touch).
  const sectionList: (DiscoverItem | null)[] = [
    interestsLife.length ? { type: 'groups', groups: interestsLife } : null,
    taste && taste.type === 'taste' ? { type: 'taste', groups: taste.groups } : null,
    firstDates && firstDates.type === 'facts' ? { type: 'firstDate', facts: firstDates.facts } : null,
  ];
  const sections = sectionList.filter((x): x is DiscoverItem => !!x);
  const leftoverPhotos: DiscoverItem[] = [];
  for (let i = 3; i < p.photoCount; i += 1) leftoverPhotos.push({ type: 'photo', photoIndex: i, target: photoTarget(p, i) });
  const extraPrompts = prompts.slice(2);

  // Gaps sit between the long sections; First dates stays last, so with one
  // section the leftovers go before it. Photos are spread evenly (earlier
  // gaps take the remainder); a leftover prompt goes between two photos of
  // the same gap, otherwise into the emptiest gap — two photos never touch
  // while a prompt is available to separate them.
  const gapCount = Math.max(1, sections.length - 1);
  const gaps: DiscoverItem[][] = Array.from({ length: gapCount }, () => []);
  let pi = 0;
  for (let g = 0; g < gapCount; g += 1) {
    const n = Math.floor(leftoverPhotos.length / gapCount) + (g < leftoverPhotos.length % gapCount ? 1 : 0);
    for (let j = 0; j < n; j += 1) {
      const pr = j > 0 ? extraPrompts.shift() : undefined;
      if (pr) gaps[g].push(pr);
      gaps[g].push(leftoverPhotos[pi]);
      pi += 1;
    }
  }
  for (const pr of extraPrompts) {
    const g = gaps.reduce((best, cur, i) => (cur.length < gaps[best].length ? i : best), 0);
    gaps[g].push(pr);
  }

  const tail: DiscoverItem[] = [];
  if (sections.length <= 1) {
    tail.push(...gaps[0], ...sections);
  } else {
    sections.forEach((sec, i) => {
      tail.push(sec);
      if (i < gapCount) tail.push(...gaps[i]);
    });
  }
  return [...head.filter((x): x is DiscoverItem => !!x), ...tail];
}


export type ScreenKind = 'error' | 'empty' | 'profile';

/** What the screen shows around the profile. "Typing" needs both the
 * keyboard and an open editor: the comment field is the only input, so a
 * stale keyboard flag (a missed hide event when Send unmounts the field)
 * can never hide the only way forward on a liked profile. */
export function chromeVisibility(o: {
  kind: ScreenKind;
  keyboardOpen: boolean;
  editorOpen: boolean;
  liked: boolean;
  outOfLikes: boolean;
}) {
  const typing = o.keyboardOpen && o.editorOpen;
  const profile = o.kind === 'profile';
  return {
    typing,
    tabBar: !typing,
    pass: profile && !typing && !o.liked,
    nextProfile: profile && !typing && o.liked,
    outOfLikesNote: profile && !typing && !o.liked && o.outOfLikes,
  };
}

export const STATE_COPY = {
  emptyTitle: 'No new profiles right now',
  emptyText: 'You’ve seen everyone who matches your preferences for now. Check back later.',
  errorTitle: 'Couldn’t load profiles',
  errorText: 'Check your connection and try again.',
  retry: 'Try again',
  // No refresh time: only shown once the server provides one.
  outOfLikes: 'You’re out of likes. You can still look through profiles.',
} as const;

export const likesLeftLabel = (n: number) => `${n} ${n === 1 ? 'like' : 'likes'} left`;
