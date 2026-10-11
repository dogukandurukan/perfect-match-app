// DEV-only Activity design preview: synthetic people + a pure in-memory
// reducer. Nothing here reads or writes Supabase — no like, match, message
// or read state is stored anywhere. The real Activity tab is untouched.
//
// Preview rules (design scope, NOT approved service rules):
//   • "Likes you" count = people still waiting (pending likes), never the
//     unread count.
//   • Opening a profile marks that like as read but does NOT accept it; a
//     read like stays in the pending list.
//   • An explicit "Like back" in the profile simulates the match: the person
//     leaves "Likes you" and appears under "New matches" (unread).
//   • Open chat opens a synthetic chat; nothing is sent automatically. A
//     like's comment is shown as context, never as a chat message.
//   • "Mark all as read" applies to the whole preview and is shown only when
//     something is unread.
import { type DiscoverPerson } from '@/lib/discover/profileLayout';
import { DISCOVER_PEOPLE } from '@/lib/dev/discoverPreview';
import { promptLabel } from '@/lib/onboardingV2/yourProfile';

export type LikeTarget =
  | { kind: 'photo'; myPhotoIndex: number }
  | { kind: 'prompt'; promptId: string; answer: string };

export type PendingLike = {
  id: string;
  personId: string;
  minutesAgo: number;
  read: boolean;
  target: LikeTarget;
  comment: string | null;
};

export type PreviewMessage = { id: string; fromMe: boolean; text: string };

export type NewMatch = {
  id: string;
  personId: string;
  minutesAgo: number;
  read: boolean;
  /** What led to the match — context only (never a message). */
  context: { fromMe: boolean; target: LikeTarget; comment: string | null }[];
  messages: PreviewMessage[];
};

export type ActivityLoad = 'ready' | 'loading' | 'error';

export type ActivityState = {
  load: ActivityLoad;
  likes: PendingLike[];
  matches: NewMatch[];
};

/** "Me" = the viewer; liked photos / answers are mine. */
export const ME_ID = 'mert';

const ME = DISCOVER_PEOPLE.find((p) => p.id === ME_ID) as DiscoverPerson;
export const MY_PROMPTS = ME.prompts;

const LONG_COMMENT =
  'Your Kordon photo made me smile — is that the spot near Alsancak? I always end up walking there at sunset with a simit, so I had to say hi. Also: tea or coffee after?';

export const INITIAL_ACTIVITY: ActivityState = {
  load: 'ready',
  likes: [
    { id: 'l-defne', personId: 'defne', minutesAgo: 12, read: false, target: { kind: 'photo', myPhotoIndex: 1 }, comment: LONG_COMMENT },
    { id: 'l-zeynep', personId: 'zeynep', minutesAgo: 95, read: false, target: { kind: 'photo', myPhotoIndex: 0 }, comment: null },
    {
      id: 'l-ece',
      personId: 'ece',
      minutesAgo: 60 * 26,
      read: true,
      target: { kind: 'prompt', promptId: MY_PROMPTS[1].promptId, answer: MY_PROMPTS[1].answer },
      comment: 'Boyoz with a strong tea is the only correct answer.',
    },
  ],
  matches: [
    {
      id: 'm-asya',
      personId: 'asya',
      minutesAgo: 40,
      read: false,
      context: [{ fromMe: false, target: { kind: 'prompt', promptId: MY_PROMPTS[0].promptId, answer: MY_PROMPTS[0].answer }, comment: 'Count me in for the Kordon ride.' }],
      messages: [],
    },
    {
      id: 'm-melis',
      personId: 'melis',
      minutesAgo: 60 * 50,
      read: true,
      context: [{ fromMe: true, target: { kind: 'photo', myPhotoIndex: 0 }, comment: null }],
      messages: [
        { id: 'x1', fromMe: false, text: 'Hey! Loved your hiking photo.' },
        { id: 'x2', fromMe: true, text: 'Thanks! Belgrad Forest, last weekend.' },
      ],
    },
  ],
};

export type ActivityScenario = 'normal' | 'empty' | 'loading' | 'error';

export type ActivityAction =
  | { type: 'reset' }
  | { type: 'scenario'; scenario: ActivityScenario }
  | { type: 'retry' }
  | { type: 'open_profile'; likeId: string }
  | { type: 'like_back'; likeId: string }
  | { type: 'open_chat'; matchId: string }
  | { type: 'send_message'; matchId: string; text: string }
  | { type: 'mark_all_read' };

export function activityReducer(s: ActivityState, a: ActivityAction): ActivityState {
  switch (a.type) {
    case 'reset':
      return INITIAL_ACTIVITY;
    case 'scenario':
      if (a.scenario === 'normal') return INITIAL_ACTIVITY;
      if (a.scenario === 'empty') return { load: 'ready', likes: [], matches: [] };
      return { ...s, load: a.scenario };
    case 'retry':
      return s.load === 'error' ? { ...s, load: 'ready' } : s;
    case 'open_profile':
      // Viewing ≠ accepting: only marks it read; it stays pending.
      return { ...s, likes: s.likes.map((l) => (l.id === a.likeId ? { ...l, read: true } : l)) };
    case 'like_back': {
      const like = s.likes.find((l) => l.id === a.likeId);
      if (!like) return s;
      const match: NewMatch = {
        id: `m-${like.personId}`,
        personId: like.personId,
        minutesAgo: 0,
        read: false,
        context: [{ fromMe: false, target: like.target, comment: like.comment }],
        messages: [],
      };
      return { ...s, likes: s.likes.filter((l) => l.id !== a.likeId), matches: [match, ...s.matches.filter((m) => m.personId !== like.personId)] };
    }
    case 'open_chat':
      return { ...s, matches: s.matches.map((m) => (m.id === a.matchId ? { ...m, read: true } : m)) };
    case 'send_message': {
      const text = a.text.trim();
      if (!text) return s;
      return {
        ...s,
        matches: s.matches.map((m) =>
          m.id === a.matchId ? { ...m, messages: [...m.messages, { id: `local-${m.messages.length + 1}`, fromMe: true, text }] } : m,
        ),
      };
    }
    case 'mark_all_read':
      return { ...s, likes: s.likes.map((l) => ({ ...l, read: true })), matches: s.matches.map((m) => ({ ...m, read: true })) };
    default:
      return s;
  }
}

/** People waiting for an answer (never the unread count). */
export const pendingCount = (s: ActivityState) => s.likes.length;
export const unreadCount = (s: ActivityState) => s.likes.filter((l) => !l.read).length + s.matches.filter((m) => !m.read).length;
export const showMarkAllRead = (s: ActivityState) => s.load === 'ready' && unreadCount(s) > 0;
export const conversationStarted = (m: NewMatch) => m.messages.length > 0;
/** Subtitle of a match row — never "Say hi" once a conversation started. */
export const matchSubtitle = (m: NewMatch) => (conversationStarted(m) ? 'Conversation started' : 'New match');

export function timeAgo(minutes: number): string {
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 60 * 48) return 'Yesterday';
  return `${Math.floor(minutes / (60 * 24))}d`;
}

/** One line for the liked content ("Liked your photo" / "Liked your answer"). */
export function likedWhat(t: LikeTarget): string {
  return t.kind === 'photo' ? 'Liked your photo' : 'Liked your answer';
}
export const promptQuestion = (t: LikeTarget) => (t.kind === 'prompt' ? promptLabel(t.promptId) : '');

const clone = (base: string, over: Partial<DiscoverPerson>): DiscoverPerson => {
  const b = DISCOVER_PEOPLE.find((p) => p.id === base) as DiscoverPerson;
  return { ...b, ...over };
};

/** Synthetic people (fictional). City shown (no district consent). */
export const ACTIVITY_PEOPLE: Record<string, DiscoverPerson> = {
  defne: { ...(DISCOVER_PEOPLE.find((p) => p.id === 'defne') as DiscoverPerson), district: null },
  ece: { ...(DISCOVER_PEOPLE.find((p) => p.id === 'ece') as DiscoverPerson), district: null },
  zeynep: clone('ece', { id: 'zeynep', name: 'Zeynep', age: 30, district: null, photoCount: 2, jobTitle: 'Architect', zodiac: 'Virgo',
    prompts: [{ promptId: 'ask_me_about', answer: 'Why every old building in Beyoğlu has a story.' }, { promptId: 'always_make_time_for', answer: 'Sunday breakfast with my grandmother.' }] }),
  asya: clone('defne', { id: 'asya', name: 'Asya', age: 28, district: null, photoCount: 2, jobTitle: 'Illustrator', zodiac: 'Gemini',
    prompts: [{ promptId: 'funny_little_habit', answer: 'Naming every cat I meet.' }, { promptId: 'together_we_could', answer: 'Draw the Bosphorus from both sides.' }] }),
  melis: clone('ece', { id: 'melis', name: 'Melis', age: 33, district: null, photoCount: 2, jobTitle: 'Physiotherapist', zodiac: 'Aquarius',
    prompts: [{ promptId: 'after_a_long_day', answer: 'A long walk and no screens.' }, { promptId: 'comfort_food', answer: 'Mercimek çorbası.' }] }),
};

export const personOf = (id: string): DiscoverPerson => ACTIVITY_PEOPLE[id];
