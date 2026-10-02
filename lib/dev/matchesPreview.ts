// DEV-only Matches design preview: local fixtures + a pure state reducer.
// Nothing here reads or writes Supabase — no likes, messages or matches are
// created, and "Reset" only resets this in-memory state. The real Matches
// screen (components/main/V2MatchesScreen.tsx) is untouched.
//
// Product rules mirrored from the brief (V2_MATCHES_DESIGN_PREVIEW_RESULT.md):
//   • "Picked for you" = one person you haven't matched with yet.
//   • "You both liked" = a mutual like with no message yet.
//   • A photo/prompt like may carry an optional comment; the comment alone
//     never opens a chat.
//   • No message exists until the user sends one. After the first message
//     the card says "Conversation started"; the chat continues in Chats.
//   • No compatibility %, no "Continue chatting", no last-message preview,
//     no timer, no meeting invite.
import { EMPTY_LIFE_DRAFT } from '@/lib/onboardingV2/yourLife';
import type { PublicProfileInput } from '@/lib/onboardingV2/yourProfile';
import type { TasteItem } from '@/lib/onboardingV2/yourWorld';

/** Same limit as likes.note on the server (char_length <= 240). */
export const COMMENT_MAX = 240;

export type PreviewPersonKey = 'pick' | 'mutual';

/** What a like points at. Photo index 0 is the main photo. */
export type LikeTarget =
  | { kind: 'photo'; photoIndex: number }
  | { kind: 'prompt'; label: string; answer: string };

export type SentLike = { target: LikeTarget; comment: string };
export type PreviewMessage = { id: string; text: string };

export type PreviewState = {
  pick: { present: boolean; like: SentLike | null };
  mutual: { present: boolean; messages: PreviewMessage[] };
};

export const INITIAL_PREVIEW_STATE: PreviewState = {
  pick: { present: true, like: null },
  mutual: { present: true, messages: [] },
};

export type PreviewScenario = 'both' | 'no_mutual' | 'no_pick';

export type PreviewAction =
  | { type: 'reset' }
  | { type: 'scenario'; scenario: PreviewScenario }
  | { type: 'send_like'; target: LikeTarget; comment: string }
  | { type: 'send_message'; text: string };

export function previewReducer(s: PreviewState, a: PreviewAction): PreviewState {
  switch (a.type) {
    case 'reset':
      return INITIAL_PREVIEW_STATE;
    case 'scenario':
      return {
        pick: { present: a.scenario !== 'no_pick', like: null },
        mutual: { present: a.scenario !== 'no_mutual', messages: [] },
      };
    case 'send_like': {
      // One like per person (likes is unique per liker → likee). The
      // comment never touches the mutual card or creates a message.
      if (!s.pick.present || s.pick.like) return s;
      const comment = a.comment.trim().slice(0, COMMENT_MAX);
      return { ...s, pick: { ...s.pick, like: { target: a.target, comment } } };
    }
    case 'send_message': {
      const text = a.text.trim();
      // Only the first message is part of this preview; the conversation
      // continues in Chats (which this preview never writes to).
      if (!s.mutual.present || !text || s.mutual.messages.length > 0) return s;
      return { ...s, mutual: { ...s.mutual, messages: [{ id: 'local-1', text }] } };
    }
    default:
      return s;
  }
}

export type PickStatus = 'none' | 'new' | 'like_sent';
export type MutualStatus = 'none' | 'new' | 'conversation_started';

export function pickStatus(s: PreviewState): PickStatus {
  if (!s.pick.present) return 'none';
  return s.pick.like ? 'like_sent' : 'new';
}

export function mutualStatus(s: PreviewState): MutualStatus {
  if (!s.mutual.present) return 'none';
  return s.mutual.messages.length > 0 ? 'conversation_started' : 'new';
}

/** User-facing copy, kept in one place (and checked: no %, no timers). */
export const PREVIEW_COPY = {
  title: 'Matches',
  pickedTitle: 'Picked for you',
  mutualTitle: 'You both liked',
  viewProfile: 'View profile',
  sayHello: 'Say hello',
  likeSent: 'Like sent',
  likeSentNote: 'If they like you back, you can start a chat.',
  commentSentNote: 'Your comment was sent with your like. A chat opens only if you both like each other.',
  conversationStarted: 'Conversation started',
  conversationNote: 'Your conversation continues in Chats.',
  noPickTitle: 'No new picks right now',
  noPickText: 'New people picked for you will appear here.',
  noMutualTitle: 'No mutual likes yet',
  noMutualText: 'When you and someone both like each other, they’ll appear here.',
  addComment: 'Add a comment (optional)',
  sendLike: 'Send like',
  chatEmptyTitle: (name: string) => `You and ${name} liked each other`,
  chatEmptyText: 'Say hello when you’re ready.',
  chatAfterFirst: 'Conversation started. It continues in Chats.',
  chatPlaceholder: 'Write a message…',
} as const;

const item = (kind: TasteItem['kind'], id: string, title: string, subtitle?: string): TasteItem => ({
  kind,
  source: 'sample',
  id: `preview:${id}`,
  title,
  subtitle,
});

/** Fixture people (fictional; names chosen not to clash with the dev pool).
 * Photos are attached by the screen (bundled placeholder images). */
export type PreviewPerson = Omit<PublicProfileInput, 'photos'> & { key: PreviewPersonKey };

export const PREVIEW_PEOPLE: Record<PreviewPersonKey, PreviewPerson> = {
  pick: {
    key: 'pick',
    name: 'Defne',
    age: 29,
    zodiac: 'Aries',
    city: 'İstanbul',
    heightCm: 166,
    workStatus: 'full_time',
    jobTitle: 'Product designer',
    school: item('school', 'school-1', 'Boğaziçi University'),
    hometown: item('hometown', 'home-1', 'İzmir'),
    intent: 'long_term',
    values: ['trust', 'growth'],
    interests: ['art', 'travel', 'food'],
    life: { ...EMPTY_LIFE_DRAFT, smoking: 'no', drinking: 'sometimes', pets: 'have_pets', petKind: 'cat', activity: 'somewhat' },
    dates: { dateTypes: ['coffee', 'walk'], spotText: '', days: 'weekends', time: 'daytime' },
    artists: [],
    books: [item('book', 'book-1', 'Tutunamayanlar', 'Oğuz Atay')],
    screen: [],
    prompts: [
      { promptId: 'small_thing_i_love', answer: 'Fresh simit and the first ferry of the day.' },
      { promptId: 'together_we_could', answer: 'Find the best kumpir on the Asian side.' },
    ],
  },
  mutual: {
    key: 'mutual',
    name: 'İpek',
    age: 31,
    zodiac: 'Cancer',
    city: 'İstanbul',
    heightCm: 170,
    workStatus: 'self_employed',
    jobTitle: 'Ceramic artist',
    school: null,
    hometown: item('hometown', 'home-2', 'Eskişehir'),
    intent: 'long_term',
    values: ['stability', 'trust'],
    interests: ['art', 'wellness'],
    life: { ...EMPTY_LIFE_DRAFT, smoking: 'no', drinking: 'sometimes', pets: 'have_pets', petKind: 'dog', activity: 'not_very' },
    dates: { dateTypes: ['coffee'], spotText: '', days: 'weekends', time: 'either' },
    artists: [],
    books: [],
    screen: [],
    prompts: [
      { promptId: 'oddly_good_at', answer: 'Fixing chipped mugs so you can’t tell.' },
      { promptId: 'sunday_starts_with', answer: 'Clay, coffee, and a long playlist.' },
    ],
  },
};

/** "Defne, 29" — for accessibility labels and the like sheet. */
export function personLabel(p: PreviewPerson): string {
  return p.age !== null ? `${p.name}, ${p.age}` : p.name;
}
