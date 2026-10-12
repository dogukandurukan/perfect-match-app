// DEV-only Activity design preview (mockup 2026-10-12: Activity → Profile →
// Match & chat): synthetic people + a pure in-memory reducer. Nothing here
// reads or writes Supabase — no like, match, message or read state is
// stored anywhere. The real Activity tab is untouched.
//
// Preview rules (D75–D81, docs/tempa/DECISIONS.md):
//   • One vertical feed. Incoming interest = one large photo card per
//     person (a like and its comment are merged into that one card).
//     Matches = small "You and X matched" rows that open the chat.
//   • A person is never both pending and matched: once matched, their card
//     becomes the match row.
//   • Read state is separate from match state. Viewing a card / profile
//     marks it read; it never accepts the interest.
//   • ONE accept action, "Match & chat": creates the match right away and
//     opens the chat — no first message needed, no celebration screen.
//     Repeats never create a second match; a failure never looks matched.
//   • The like / comment is chat CONTEXT ("How it started"), never a
//     message. Nothing is sent on the user's behalf.
import { interestLabelFor, MATCH_COPY, matchedLine, matchedWhen, timeAgo, timeAgoLong } from '@/lib/activity/copy';
import { heroLocation, type DiscoverPerson } from '@/lib/discover/profileLayout';
import { DISCOVER_PEOPLE } from '@/lib/dev/discoverPreview';
import { promptLabel } from '@/lib/onboardingV2/yourProfile';

export type LikeTarget =
  | { kind: 'profile' }
  | { kind: 'photo'; myPhotoIndex: number }
  | { kind: 'prompt'; promptId: string; answer: string };

/** One incoming interest (from a raw like, optionally with its comment). */
export type Interest = {
  personId: string;
  minutesAgo: number;
  read: boolean;
  target: LikeTarget;
  comment: string | null;
};

export type PreviewMessage = { id: string; fromMe: boolean; text: string };

export type Match = {
  id: string;
  personId: string;
  minutesAgo: number;
  read: boolean;
  /** How it started — context only, never a message. */
  started: { fromMe: boolean; target: LikeTarget; comment: string | null } | null;
  messages: PreviewMessage[];
};

export type ActivityLoad = 'ready' | 'loading' | 'error';

export type ActivityState = {
  load: ActivityLoad;
  interests: Interest[];
  matches: Match[];
  /** A Match & chat is in flight for this person (button disabled). */
  matching: string | null;
  /** Last Match & chat failed for this person (inline error + retry). */
  matchError: string | null;
  /** DEV switch: the next Match & chat fails. */
  failNext: boolean;
  /** Last send failed in this chat (draft kept, nothing counted). */
  sendError: string | null;
  /** DEV switch: the next message send fails. */
  failSendNext: boolean;
};

/** "Me" = the viewer; liked photos / answers are mine. */
export const ME_ID = 'mert';
const ME = DISCOVER_PEOPLE.find((p) => p.id === ME_ID) as DiscoverPerson;
export const MY_PROMPTS = ME.prompts;

// ── Raw incoming events → one interest per person ──────────────────────────

/** Raw like / comment events as a server might return them. */
export type RawEvent =
  | { kind: 'like'; personId: string; minutesAgo: number; read: boolean; target: LikeTarget }
  | { kind: 'comment'; personId: string; minutesAgo: number; read: boolean; text: string };

/** Merges a person's like and comment into one card. Newest time wins; the
 * card is unread if any part is unread. Comments without a like are kept
 * as a profile-level interest. Sorted newest first. */
export function mergeIncoming(events: RawEvent[]): Interest[] {
  const by = new Map<string, Interest>();
  for (const e of events) {
    const cur = by.get(e.personId) ?? { personId: e.personId, minutesAgo: e.minutesAgo, read: true, target: { kind: 'profile' } as LikeTarget, comment: null };
    cur.minutesAgo = Math.min(cur.minutesAgo, e.minutesAgo);
    cur.read = cur.read && e.read;
    if (e.kind === 'like') cur.target = e.target;
    else if (e.text.trim()) cur.comment = e.text.trim();
    by.set(e.personId, cur);
  }
  return [...by.values()].sort((a, b) => a.minutesAgo - b.minutesAgo);
}

export const RAW_EVENTS: RawEvent[] = [
  // Photo like with a comment — arrives as two events, shown as ONE card.
  { kind: 'like', personId: 'defne', minutesAgo: 12, read: false, target: { kind: 'photo', myPhotoIndex: 1 } },
  { kind: 'comment', personId: 'defne', minutesAgo: 12, read: false, text: 'Where was this taken?' },
  // Whole-profile like, no comment.
  { kind: 'like', personId: 'zeynep', minutesAgo: 60, read: false, target: { kind: 'profile' } },
  // Prompt / answer like with a comment (already read: still pending).
  { kind: 'like', personId: 'ece', minutesAgo: 60 * 5, read: true, target: { kind: 'prompt', promptId: MY_PROMPTS[1].promptId, answer: MY_PROMPTS[1].answer } },
  { kind: 'comment', personId: 'ece', minutesAgo: 60 * 5, read: true, text: 'Boyoz with a strong tea is the only correct answer. Where do you get yours?' },
];

const INITIAL_MATCHES: Match[] = [
  // Existing match, no message yet.
  { id: 'm-selin', personId: 'selin', minutesAgo: 60 * 3, read: false,
    started: { fromMe: false, target: { kind: 'prompt', promptId: MY_PROMPTS[0].promptId, answer: MY_PROMPTS[0].answer }, comment: 'Count me in for the Kordon ride.' }, messages: [] },
  // Existing match where the conversation already started.
  { id: 'm-melis', personId: 'melis', minutesAgo: 60 * 50, read: true,
    started: { fromMe: true, target: { kind: 'photo', myPhotoIndex: 0 }, comment: null },
    messages: [
      { id: 'x1', fromMe: false, text: 'Hey! Loved your hiking photo.' },
      { id: 'x2', fromMe: true, text: 'Thanks! Belgrad Forest, last weekend.' },
    ] },
];

export const INITIAL_ACTIVITY: ActivityState = {
  load: 'ready',
  interests: mergeIncoming(RAW_EVENTS),
  matches: INITIAL_MATCHES,
  matching: null,
  matchError: null,
  failNext: false,
  sendError: null,
  failSendNext: false,
};

export type ActivityScenario = 'normal' | 'empty' | 'loading' | 'error';

export type ActivityAction =
  | { type: 'reset' }
  | { type: 'scenario'; scenario: ActivityScenario }
  | { type: 'retry' }
  | { type: 'dev_fail_next'; on: boolean }
  | { type: 'dev_fail_send_next'; on: boolean }
  | { type: 'open_profile'; personId: string }
  | { type: 'match_start'; personId: string }
  | { type: 'match_done'; personId: string }
  | { type: 'open_chat'; matchId: string }
  | { type: 'send_message'; matchId: string; text: string };

export const matchFor = (s: ActivityState, personId: string) => s.matches.find((m) => m.personId === personId) ?? null;
export const interestFor = (s: ActivityState, personId: string) => s.interests.find((i) => i.personId === personId) ?? null;

export function activityReducer(s: ActivityState, a: ActivityAction): ActivityState {
  switch (a.type) {
    case 'reset':
      return INITIAL_ACTIVITY;
    case 'scenario':
      if (a.scenario === 'normal') return INITIAL_ACTIVITY;
      if (a.scenario === 'empty') return { ...INITIAL_ACTIVITY, interests: [], matches: [] };
      return { ...s, load: a.scenario };
    case 'retry':
      return s.load === 'error' ? { ...s, load: 'ready' } : s;
    case 'dev_fail_next':
      return { ...s, failNext: a.on };
    case 'dev_fail_send_next':
      return { ...s, failSendNext: a.on };
    case 'open_profile':
      // Viewing ≠ accepting: only marks it read.
      return { ...s, interests: s.interests.map((i) => (i.personId === a.personId ? { ...i, read: true } : i)) };
    case 'match_start':
      // Already matched or a request in flight → no second request.
      if (s.matching || matchFor(s, a.personId) || !interestFor(s, a.personId)) return s;
      return { ...s, matching: a.personId, matchError: null };
    case 'match_done': {
      if (s.matching !== a.personId) return s;
      if (s.failNext) return { ...s, matching: null, matchError: a.personId, failNext: false };
      const existing = matchFor(s, a.personId);
      const it = interestFor(s, a.personId);
      if (existing || !it) return { ...s, matching: null };
      const match: Match = {
        id: `m-${a.personId}`,
        personId: a.personId,
        minutesAgo: 0,
        // The user is about to open this chat themselves.
        read: true,
        started: { fromMe: false, target: it.target, comment: it.comment },
        messages: [],
      };
      return {
        ...s,
        matching: null,
        matchError: null,
        // The pending card becomes the match row — never both.
        interests: s.interests.filter((i) => i.personId !== a.personId),
        matches: [match, ...s.matches],
      };
    }
    case 'open_chat':
      return { ...s, matches: s.matches.map((m) => (m.id === a.matchId ? { ...m, read: true } : m)) };
    case 'send_message': {
      const text = a.text.trim();
      if (!text) return s;
      // A failed send is not a message: the conversation doesn't start.
      if (s.failSendNext) return { ...s, failSendNext: false, sendError: a.matchId };
      return {
        ...s,
        sendError: null,
        matches: s.matches.map((m) =>
          m.id === a.matchId ? { ...m, messages: [...m.messages, { id: `local-${m.messages.length + 1}`, fromMe: true, text }] } : m,
        ),
      };
    }
    default:
      return s;
  }
}

// ── Feed ───────────────────────────────────────────────────────────────────

export type FeedItem =
  | { kind: 'interest'; key: string; interest: Interest }
  | { kind: 'match'; key: string; match: Match };

/** One vertical feed, newest first. One entry per person: a matched person
 * only appears as a match row. */
export function buildFeed(s: ActivityState): FeedItem[] {
  const matched = new Set(s.matches.map((m) => m.personId));
  const items: (FeedItem & { t: number })[] = [
    ...s.interests.filter((i) => !matched.has(i.personId)).map((i) => ({ kind: 'interest' as const, key: `i-${i.personId}`, interest: i, t: i.minutesAgo })),
    ...s.matches.map((m) => ({ kind: 'match' as const, key: m.id, match: m, t: m.minutesAgo })),
  ];
  return items.sort((a, b) => a.t - b.t).map(({ t: _t, ...rest }) => rest as FeedItem);
}

export const conversationStarted = (m: Match) => m.messages.length > 0;

/** "Liked you" (profile) / "Liked your photo" / "Liked your answer". */
export function interestLabel(t: LikeTarget): string {
  return interestLabelFor(t.kind);
}
/** Context line inside the profile / chat ("Defne liked your photo"). */
export const interestLine = (name: string, t: LikeTarget) => `${name} ${interestLabel(t).replace('Liked', 'liked')}`;
export const promptQuestion = (t: LikeTarget) => (t.kind === 'prompt' ? promptLabel(t.promptId) : '');

export { MATCH_COPY, matchedLine, matchedWhen, timeAgo, timeAgoLong };

// ── People (fictional; one identity from card to profile to chat) ──────────

const base = (id: string) => DISCOVER_PEOPLE.find((p) => p.id === id) as DiscoverPerson;
const clone = (from: string, over: Partial<DiscoverPerson>): DiscoverPerson => ({ ...base(from), ...over });

export const ACTIVITY_PEOPLE: Record<string, DiscoverPerson> = {
  defne: { ...base('defne'), age: 28 },
  ece: base('ece'),
  zeynep: clone('ece', { id: 'zeynep', name: 'Zeynep', age: 27, district: 'Şişli', photoCount: 2, jobTitle: 'Architect', zodiac: 'Virgo',
    prompts: [{ promptId: 'ask_me_about', answer: 'Why every old building in Beyoğlu has a story.' }, { promptId: 'always_make_time_for', answer: 'Sunday breakfast with my grandmother.' }] }),
  selin: clone('defne', { id: 'selin', name: 'Selin', age: 28, district: 'Beşiktaş', photoCount: 2, jobTitle: 'Illustrator', zodiac: 'Gemini',
    prompts: [{ promptId: 'funny_little_habit', answer: 'Naming every cat I meet.' }, { promptId: 'together_we_could', answer: 'Draw the Bosphorus from both sides.' }] }),
  melis: clone('ece', { id: 'melis', name: 'Melis', age: 33, district: null, photoCount: 2, jobTitle: 'Physiotherapist', zodiac: 'Aquarius',
    prompts: [{ promptId: 'after_a_long_day', answer: 'A long walk and no screens.' }, { promptId: 'comfort_food', answer: 'Mercimek çorbası.' }] }),
};

export const personOf = (id: string): DiscoverPerson => ACTIVITY_PEOPLE[id];
/** Same location rule as Discover: shared district, else city. */
export const personPlace = (id: string) => heroLocation(personOf(id));
