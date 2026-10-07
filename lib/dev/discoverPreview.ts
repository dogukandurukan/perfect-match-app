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
import {
  COMMENT_MAX,
  type DiscoverPerson,
  type ScreenKind,
} from '@/lib/discover/profileLayout';
import { EMPTY_LIFE_DRAFT } from '@/lib/onboardingV2/yourLife';
import type { TasteItem } from '@/lib/onboardingV2/yourWorld';

// Shared with the real V2 Discover (moved 2026-10-08); re-exported so the
// preview and its checks keep one import path.
export * from '@/lib/discover/profileLayout';

export const PREVIEW_LIKES = 3;

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


// ─── Decisions (local) ─────────────────────────────────────────────────────

export type Decision =
  | { kind: 'like'; personId: string; target: string; comment: string }
  | { kind: 'pass'; personId: string };

export type Editor = { personId: string; target: string; draft: string };

/** A like with a comment sent on the current profile (round 2): the profile
 * stays on screen with the note in place until "Next profile". */
export type SentComment = { personId: string; target: string; comment: string };

export type DiscoverState = {
  order: string[];
  index: number;
  likesLeft: number;
  editor: Editor | null;
  sent: SentComment | null;
  decisions: Decision[];
  /** Simulated candidate load result (DEV): a failed load is never shown
   * as "no one left". */
  load: 'ok' | 'error';
};

export const INITIAL_DISCOVER_STATE: DiscoverState = {
  order: DISCOVER_PEOPLE.map((p) => p.id),
  index: 0,
  likesLeft: PREVIEW_LIKES,
  editor: null,
  sent: null,
  decisions: [],
  load: 'ok',
};

export type DiscoverAction =
  | { type: 'reset'; shortFirst?: boolean }
  | { type: 'open_comment'; personId: string; target: string }
  | { type: 'edit_comment'; text: string }
  | { type: 'cancel_comment' }
  | { type: 'like'; personId: string; target: string }
  | { type: 'send_comment'; personId: string }
  | { type: 'pass'; personId: string }
  /** Only after a like was sent on this profile: shows the next person.
   * Records no pass and uses no like. */
  | { type: 'next'; personId: string }
  // DEV controls for the three states under review.
  | { type: 'dev_use_up_likes' }
  | { type: 'dev_empty' }
  | { type: 'dev_load_error' }
  | { type: 'retry' };


/** Error wins over empty: if loading failed we don't know whether anyone is
 * left, so the screen must never say so. */
export function screenKind(s: DiscoverState): ScreenKind {
  if (s.load === 'error') return 'error';
  return currentPersonId(s) ? 'profile' : 'empty';
}


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
    sent: null,
    decisions: [...s.decisions, d],
  };
}

/** True once a like (with a comment) was sent to the profile on screen. */
export function likedCurrent(s: DiscoverState): boolean {
  return !!s.sent && s.sent.personId === currentPersonId(s);
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
      if (a.personId !== cur || likedCurrent(s) || s.likesLeft <= 0) return s;
      if (s.editor && s.editor.personId === a.personId && s.editor.target === a.target) return s;
      // Only one editor at a time; opening another replaces it.
      return { ...s, editor: { personId: a.personId, target: a.target, draft: '' } };
    case 'edit_comment':
      if (!s.editor) return s;
      return { ...s, editor: { ...s.editor, draft: a.text.slice(0, COMMENT_MAX) } };
    case 'cancel_comment':
      return s.editor ? { ...s, editor: null } : s;
    case 'like':
      // One like per person: no further heart once a comment was sent.
      if (a.personId !== cur || s.likesLeft <= 0 || likedCurrent(s)) return s;
      return decide(s, { kind: 'like', personId: a.personId, target: a.target, comment: '' });
    case 'send_comment': {
      if (a.personId !== cur || s.likesLeft <= 0 || likedCurrent(s) || !s.editor || s.editor.personId !== a.personId) return s;
      const comment = s.editor.draft.trim();
      if (!comment) return s;
      // Counted once, and the profile STAYS: the editor turns into the sent
      // note in the same place; "Next profile" moves on.
      const d: Decision = { kind: 'like', personId: a.personId, target: s.editor.target, comment };
      return {
        ...s,
        likesLeft: s.likesLeft - 1,
        editor: null,
        sent: { personId: a.personId, target: d.target, comment },
        decisions: [...s.decisions, d],
      };
    }
    case 'pass':
      // On a liked profile × is replaced by "Next profile" (no dislike).
      if (a.personId !== cur || likedCurrent(s)) return s;
      return decide(s, { kind: 'pass', personId: a.personId });
    case 'next':
      if (a.personId !== cur || !likedCurrent(s)) return s;
      return { ...s, index: s.index + 1, editor: null, sent: null };
    case 'dev_use_up_likes':
      // Out of likes: browsing stays possible; any open editor closes since
      // a comment is a like.
      return { ...s, likesLeft: 0, editor: null };
    case 'dev_empty':
      return { ...s, index: s.order.length, editor: null, sent: null, load: 'ok' };
    case 'dev_load_error':
      return { ...s, editor: null, load: 'error' };
    case 'retry':
      return s.load === 'error' ? { ...s, load: 'ok' } : s;
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


