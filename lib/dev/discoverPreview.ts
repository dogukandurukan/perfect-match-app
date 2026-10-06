// DEV-only Discover (home) full-profile design preview: local fixtures, the
// proposed top-to-bottom profile order and a pure decision reducer. Nothing
// here reads or writes Supabase — likes, passes and comments stay in memory.
// The real Discover tab is untouched.
//
// Written decisions (2026-10-06 brief) mirrored here:
//   • Hero shows the district only when the person chose to share it,
//     otherwise the city (never GPS / coordinates). Preview-only: the real
//     get_profile_v2 does not return the district.
//   • No swipe; × passes; every photo / prompt has its own heart (a like with
//     no comment) and an "Add a comment" link that opens an inline editor
//     under that content. Send = one like with the comment. One editor open
//     at a time. 240-char limit (likes.note).
//   • No score, no animation, no toast: a decision simply moves to the next
//     profile. "N likes left" is a temporary preview counter, not a quota rule.
import { EMPTY_LIFE_DRAFT } from '@/lib/onboardingV2/yourLife';
import {
  buildPublicProfileBlocks,
  promptLabel,
  type PreviewFact,
  type PreviewGroup,
  type PreviewTaste,
  type PublicProfileInput,
} from '@/lib/onboardingV2/yourProfile';
import { WORK_OPTIONS, type TasteItem } from '@/lib/onboardingV2/yourWorld';

export const COMMENT_MAX = 240;
export const PREVIEW_LIKES = 3;

export type DiscoverPerson = Omit<PublicProfileInput, 'photos'> & {
  id: string;
  /** Only set when the person chose to share it in onboarding. */
  district: string | null;
  photoCount: number;
};

const item = (kind: TasteItem['kind'], id: string, title: string, subtitle?: string): TasteItem => ({
  kind,
  source: 'sample',
  id: `preview:${id}`,
  title,
  subtitle,
});

/** Fictional people. Photos are bundled placeholders keyed by `id`. */
export const DISCOVER_PEOPLE: DiscoverPerson[] = [
  // Full profile: 6 photos, 3 prompts, every section, shared district.
  {
    id: 'defne',
    name: 'Defne',
    age: 29,
    zodiac: 'Aries',
    city: 'İstanbul',
    district: 'Kadıköy',
    heightCm: 166,
    workStatus: 'full_time',
    jobTitle: 'Product designer',
    school: item('school', 's1', 'Boğaziçi University'),
    hometown: item('hometown', 'h1', 'İzmir'),
    intent: 'long_term',
    values: ['trust', 'growth', 'fun'],
    interests: ['art', 'travel', 'food', 'books'],
    life: { ...EMPTY_LIFE_DRAFT, smoking: 'no', drinking: 'sometimes', pets: 'have_pets', petKind: 'cat', activity: 'somewhat' },
    dates: { dateTypes: ['coffee', 'walk'], spotText: 'Moda sahil', days: 'weekends', time: 'daytime' },
    artists: [item('artist', 'a1', 'Sezen Aksu'), item('artist', 'a2', 'Erkin Koray')],
    books: [item('book', 'b1', 'Tutunamayanlar', 'Oğuz Atay')],
    screen: [item('screen', 'm1', 'Bir Zamanlar Anadolu’da', '2011 · Movie'), item('screen', 'm2', 'The Bear', '2022 · Series')],
    prompts: [
      { promptId: 'small_thing_i_love', answer: 'Fresh simit and the first ferry of the day.' },
      { promptId: 'together_we_could', answer: 'Find the best kumpir on the Asian side, then argue about it on the walk back.' },
      { promptId: 'ask_me_about', answer: 'Why every old building in Moda has a story.' },
    ],
    photoCount: 6,
  },
  // Short profile: 3 photos, 2 prompts, city only (no district shared), few fields.
  {
    id: 'mert',
    name: 'Mert',
    age: 32,
    zodiac: 'Libra',
    city: 'İzmir',
    district: null,
    heightCm: 181,
    workStatus: null,
    jobTitle: '',
    school: null,
    hometown: null,
    intent: 'figuring_out',
    values: [],
    interests: ['outdoors', 'sports'],
    life: { ...EMPTY_LIFE_DRAFT, smoking: 'no', activity: 'very' },
    dates: { dateTypes: ['activity'], spotText: '', days: 'either', time: 'evening' },
    artists: [],
    books: [],
    screen: [],
    prompts: [
      { promptId: 'always_say_yes_to', answer: 'A spontaneous ride along the Kordon.' },
      { promptId: 'comfort_food', answer: 'Boyoz and a strong tea.' },
    ],
    photoCount: 3,
  },
  // Medium: 4 photos, 2 prompts, long job / school names, district shared.
  {
    id: 'ece',
    name: 'Ece',
    age: 27,
    zodiac: 'Pisces',
    city: 'İstanbul',
    district: 'Şişli',
    heightCm: 171,
    workStatus: 'full_time',
    jobTitle: 'Senior user experience researcher and workshop facilitator',
    school: item('school', 's2', 'Mimar Sinan Fine Arts University, Faculty of Architecture'),
    hometown: item('hometown', 'h2', 'Eskişehir'),
    intent: 'long_term',
    values: ['respect', 'adventure'],
    interests: ['culture', 'music'],
    life: { ...EMPTY_LIFE_DRAFT, smoking: 'no', drinking: 'none', pets: 'neutral' },
    dates: { dateTypes: ['dinner'], spotText: '', days: 'weekdays', time: 'evening' },
    artists: [item('artist', 'a3', 'Nilüfer')],
    books: [],
    screen: [],
    prompts: [
      { promptId: 'oddly_good_at', answer: 'Guessing the year a building was finished, give or take five.' },
      { promptId: 'after_a_long_day', answer: 'Long bath, old records, no screens.' },
    ],
    photoCount: 4,
  },
];

// ─── Profile order ─────────────────────────────────────────────────────────

/** A labelled personal detail ("Hometown" / "İzmir"). */
export type LabelledFact = { icon: string; label: string; value: string };

export type DiscoverItem =
  | { type: 'hero'; photoIndex: 0; name: string; age: number | null; location: string | null }
  | { type: 'prompt'; key: string; label: string; answer: string }
  | { type: 'details'; facts: LabelledFact[] }
  | { type: 'photo'; photoIndex: number }
  | { type: 'groups'; groups: PreviewGroup[] }
  | { type: 'taste'; groups: PreviewTaste[] }
  | { type: 'firstDate'; facts: PreviewFact[] };

/** District when shared, otherwise the city. Never coordinates. */
export function heroLocation(p: Pick<DiscoverPerson, 'district' | 'city'>): string | null {
  return p.district?.trim() || p.city?.trim() || null;
}

/** Hometown / height / zodiac / job / school — the location is on the hero,
 * so it is not repeated here. Empty fields are left out. */
export function personalDetails(p: DiscoverPerson): LabelledFact[] {
  const job = p.jobTitle.trim() || WORK_OPTIONS.find((w) => w.key === p.workStatus)?.title || '';
  const out: (LabelledFact | null)[] = [
    p.hometown ? { icon: 'home-outline', label: 'Hometown', value: p.hometown.title } : null,
    p.heightCm ? { icon: 'resize-outline', label: 'Height', value: `${p.heightCm} cm` } : null,
    p.zodiac ? { icon: 'planet-outline', label: 'Zodiac', value: p.zodiac } : null,
    job ? { icon: 'briefcase-outline', label: 'Job', value: job } : null,
    p.school ? { icon: 'school-outline', label: 'School', value: p.school.title } : null,
  ];
  return out.filter((x): x is LabelledFact => !!x);
}

export const photoKey = (i: number) => `photo:${i}`;
export const promptKey = (promptId: string) => `prompt:${promptId}`;

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
    .map((a) => ({ type: 'prompt' as const, key: promptKey(a.promptId), label: promptLabel(a.promptId), answer: a.answer }));
  const photo = (i: number): DiscoverItem | null => (i < p.photoCount ? { type: 'photo', photoIndex: i } : null);

  const lookingFor = allGroups.filter((g) => g.title === 'Looking for' || g.title === 'What matters most');
  const interestsLife: PreviewGroup[] = [
    ...allGroups.filter((g) => g.title === 'Into'),
    ...(lifestyle && lifestyle.type === 'facts' ? [{ title: 'Lifestyle', items: lifestyle.facts }] : []),
  ];
  const details = personalDetails(p);

  const head: (DiscoverItem | null)[] = [
    { type: 'hero', photoIndex: 0, name: p.name, age: p.age, location: heroLocation(p) },
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
  for (let i = 3; i < p.photoCount; i += 1) leftoverPhotos.push({ type: 'photo', photoIndex: i });
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

// ─── Decisions (local) ─────────────────────────────────────────────────────

export type Decision =
  | { kind: 'like'; personId: string; target: string; comment: string }
  | { kind: 'pass'; personId: string };

export type Editor = { personId: string; target: string; draft: string };

export type DiscoverState = {
  order: string[];
  index: number;
  likesLeft: number;
  editor: Editor | null;
  decisions: Decision[];
};

export const INITIAL_DISCOVER_STATE: DiscoverState = {
  order: DISCOVER_PEOPLE.map((p) => p.id),
  index: 0,
  likesLeft: PREVIEW_LIKES,
  editor: null,
  decisions: [],
};

export type DiscoverAction =
  | { type: 'reset'; shortFirst?: boolean }
  | { type: 'open_comment'; personId: string; target: string }
  | { type: 'edit_comment'; text: string }
  | { type: 'cancel_comment' }
  | { type: 'like'; personId: string; target: string }
  | { type: 'send_comment'; personId: string }
  | { type: 'pass'; personId: string };

export function currentPersonId(s: DiscoverState): string | null {
  return s.order[s.index] ?? null;
}

export function personById(id: string | null): DiscoverPerson | null {
  return DISCOVER_PEOPLE.find((p) => p.id === id) ?? null;
}

function decide(s: DiscoverState, d: Decision): DiscoverState {
  return {
    ...s,
    index: s.index + 1,
    likesLeft: d.kind === 'like' ? s.likesLeft - 1 : s.likesLeft,
    editor: null,
    decisions: [...s.decisions, d],
  };
}

/** Every decision names the profile it was made on: a repeated tap (or a
 * stale callback) for a profile that is no longer current does nothing, so
 * a double tap can never make two decisions or skip two profiles. */
export function discoverReducer(s: DiscoverState, a: DiscoverAction): DiscoverState {
  const cur = currentPersonId(s);
  switch (a.type) {
    case 'reset': {
      const ids = DISCOVER_PEOPLE.map((p) => p.id);
      const order = a.shortFirst ? ['mert', ...ids.filter((x) => x !== 'mert')] : ids;
      return { ...INITIAL_DISCOVER_STATE, order };
    }
    case 'open_comment':
      if (a.personId !== cur) return s;
      if (s.editor && s.editor.personId === a.personId && s.editor.target === a.target) return s;
      // Only one editor at a time; opening another replaces it.
      return { ...s, editor: { personId: a.personId, target: a.target, draft: '' } };
    case 'edit_comment':
      if (!s.editor) return s;
      return { ...s, editor: { ...s.editor, draft: a.text.slice(0, COMMENT_MAX) } };
    case 'cancel_comment':
      return s.editor ? { ...s, editor: null } : s;
    case 'like':
      if (a.personId !== cur || s.likesLeft <= 0) return s;
      return decide(s, { kind: 'like', personId: a.personId, target: a.target, comment: '' });
    case 'send_comment': {
      if (a.personId !== cur || s.likesLeft <= 0 || !s.editor || s.editor.personId !== a.personId) return s;
      const comment = s.editor.draft.trim();
      if (!comment) return s;
      return decide(s, { kind: 'like', personId: a.personId, target: s.editor.target, comment });
    }
    case 'pass':
      if (a.personId !== cur) return s;
      return decide(s, { kind: 'pass', personId: a.personId });
    default:
      return s;
  }
}

/** One plain line for the DEV panel ("Liked Defne's prompt with a comment"). */
export function describeDecision(d: Decision | undefined): string {
  if (!d) return 'No decision yet';
  const name = personById(d.personId)?.name ?? 'profile';
  if (d.kind === 'pass') return `Passed ${name}`;
  const what = d.target.startsWith('photo:')
    ? Number(d.target.slice(6)) === 0
      ? 'main photo'
      : `photo ${Number(d.target.slice(6)) + 1}`
    : 'prompt';
  return `Liked ${name}’s ${what}${d.comment ? ' with a comment' : ''}`;
}

export const likesLeftLabel = (n: number) => `${n} ${n === 1 ? 'like' : 'likes'} left`;
