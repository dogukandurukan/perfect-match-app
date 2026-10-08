// DEV-only Matches design preview: local fixtures + a pure state reducer.
// Nothing here reads or writes Supabase — no likes, messages or matches are
// created, and Reset only resets this in-memory state. The real Matches tab
// (components/main/V2MatchesScreen.tsx) is untouched.
//
// Daily picks (owner decisions D61–D66, 2026-10-08), SIMULATED here:
//   • Matches features one "Picked for you" person and one "You both liked"
//     person per daily pick period; periods change at 12:00 Istanbul time.
//     In this preview a period only changes when the DEV "Simulate 12:00
//     refresh" button is pressed — no timer, no clock, no algorithm. The
//     real period and refresh time will come from the server.
//   • A refresh only changes which cards are featured: likes, matches and
//     conversations never end.
//   • "You both liked" features a mutual match with no conversation yet. After
//     the first message the card shows "Conversation started" for the rest of
//     that period, and the person is not featured again (Chats continues).
//   • One person never appears in both sections. If the featured pick likes
//     you back during the period, the SAME card shows the new state (Say
//     hello) — no second copy.
//   • No suitable new person → the section's empty state; a person is never
//     re-offered as a new pick. Matches stay reachable in Chats either way.
//   • The order below is a fixed list of synthetic examples, NOT a scoring or
//     selection rule (weights are undecided).
import { COMMENT_MAX, type DiscoverPerson } from '@/lib/discover/profileLayout';
import { DISCOVER_PEOPLE } from '@/lib/dev/discoverPreview';
import { MATCHES_COPY } from '@/lib/matches/copy';

export { COMMENT_MAX };

export type SentLike = { target: string; comment: string };
export type PreviewMessage = { id: string; text: string };

/** Fixed synthetic examples (not a ranking): who could be featured as a new
 * pick, in this order, and who is already a mutual match at the start. */
export const PICK_POOL = ['defne', 'mert'] as const;
export const INITIAL_MATCHES = ['ece'] as const;

export type PreviewState = {
  /** Simulated daily pick period (1 = today). */
  period: number;
  pickId: string | null;
  mutualId: string | null;
  /** Everyone ever featured as a pick — never re-offered as new. */
  featuredPicks: string[];
  likes: Record<string, SentLike>;
  /** Mutual matches in the order they happened (persist across periods). */
  matchOrder: string[];
  messages: Record<string, PreviewMessage[]>;
};

export const INITIAL_PREVIEW_STATE: PreviewState = {
  period: 1,
  pickId: PICK_POOL[0],
  mutualId: INITIAL_MATCHES[0],
  featuredPicks: [PICK_POOL[0]],
  likes: {},
  matchOrder: [...INITIAL_MATCHES],
  messages: {},
};

export type PreviewScenario = 'both' | 'no_mutual' | 'no_pick' | 'like_sent' | 'conversation_started';

export type PreviewAction =
  | { type: 'reset' }
  | { type: 'scenario'; scenario: PreviewScenario }
  | { type: 'send_like'; personId: string; target: string; comment: string }
  /** DEV: the featured pick likes you back (only after your like). */
  | { type: 'they_like_back' }
  | { type: 'send_message'; personId: string; text: string }
  /** DEV: simulate the 12:00 daily refresh. */
  | { type: 'refresh' };

/** Demo text used only by the DEV "Conversation started" shortcut. */
export const DEMO_FIRST_MESSAGE = 'Hi! (demo message — not sent anywhere)';

export const isMatched = (s: PreviewState, id: string) => s.matchOrder.includes(id);
export const hasConversation = (s: PreviewState, id: string) => (s.messages[id]?.length ?? 0) > 0;

/** Pure "12:00" step: a new pick nobody has seen featured before (not liked,
 * not matched), and the earliest mutual match without a conversation that
 * isn't the new pick. Likes, matches and messages carry over unchanged. */
export function nextPeriod(s: PreviewState): PreviewState {
  const pickId = PICK_POOL.find((id) => !s.featuredPicks.includes(id) && !s.likes[id] && !isMatched(s, id)) ?? null;
  const mutualId = s.matchOrder.find((id) => !hasConversation(s, id) && id !== pickId) ?? null;
  return {
    ...s,
    period: s.period + 1,
    pickId,
    mutualId,
    featuredPicks: pickId ? [...s.featuredPicks, pickId] : s.featuredPicks,
  };
}

export function previewReducer(s: PreviewState, a: PreviewAction): PreviewState {
  switch (a.type) {
    case 'reset':
      return INITIAL_PREVIEW_STATE;
    case 'refresh':
      return nextPeriod(s);
    case 'scenario':
      switch (a.scenario) {
        case 'both':
          return INITIAL_PREVIEW_STATE;
        case 'no_mutual':
          return { ...s, mutualId: null, matchOrder: s.pickId && isMatched(s, s.pickId) ? [s.pickId] : [] };
        case 'no_pick':
          return { ...s, pickId: null };
        case 'like_sent':
          return s.pickId && !s.likes[s.pickId] ? { ...s, likes: { ...s.likes, [s.pickId]: { target: 'photo:0', comment: '' } } } : s;
        case 'conversation_started':
          return s.mutualId && !hasConversation(s, s.mutualId)
            ? { ...s, messages: { ...s.messages, [s.mutualId]: [{ id: 'local-1', text: DEMO_FIRST_MESSAGE }] } }
            : s;
        default:
          return s;
      }
    case 'send_like': {
      // Only the featured pick can be liked here; one like per person; a like
      // never creates a match, a chat or a message.
      if (a.personId !== s.pickId || s.likes[a.personId] || isMatched(s, a.personId)) return s;
      const comment = a.comment.trim().slice(0, COMMENT_MAX);
      return { ...s, likes: { ...s.likes, [a.personId]: { target: a.target, comment } } };
    }
    case 'they_like_back': {
      const id = s.pickId;
      if (!id || !s.likes[id] || isMatched(s, id)) return s;
      // Same card updates; the person is NOT added to the other section.
      return { ...s, matchOrder: [...s.matchOrder, id] };
    }
    case 'send_message': {
      const text = a.text.trim();
      // Only a match can be messaged; only the first message is part of this
      // preview (the conversation continues in Chats, never written here).
      if (!text || !isMatched(s, a.personId) || hasConversation(s, a.personId)) return s;
      return { ...s, messages: { ...s.messages, [a.personId]: [{ id: 'local-1', text }] } };
    }
    default:
      return s;
  }
}

/** The featured pick card. */
export type PickStatus = 'none' | 'new' | 'like_sent' | 'matched' | 'conversation_started';
/** The featured mutual card. `none_today` = matches exist but none is left
 * to feature (all already talking); `none` = no mutual matches at all. */
export type MutualStatus = 'none' | 'none_today' | 'new' | 'conversation_started';

export function pickStatus(s: PreviewState): PickStatus {
  const id = s.pickId;
  if (!id) return 'none';
  if (isMatched(s, id)) return hasConversation(s, id) ? 'conversation_started' : 'matched';
  return s.likes[id] ? 'like_sent' : 'new';
}

export function mutualStatus(s: PreviewState): MutualStatus {
  const id = s.mutualId;
  if (!id) return s.matchOrder.some((m) => m !== s.pickId) ? 'none_today' : 'none';
  return hasConversation(s, id) ? 'conversation_started' : 'new';
}

/** User-facing copy: the shared approved Matches copy + preview chat lines. */
export const PREVIEW_COPY = {
  ...MATCHES_COPY,
  chatEmptyTitle: (name: string) => `You and ${name} liked each other`,
  chatEmptyText: 'Say hello when you’re ready.',
  chatAfterFirst: 'Conversation started. It continues in Chats.',
  chatPlaceholder: 'Write a message…',
} as const;

/** Fixed synthetic people (the approved Discover preview fixtures). The
 * location follows the current server rule: no explicit "show my district"
 * choice exists, so the city is shown even though a district is filled. */
export function previewPerson(id: string): DiscoverPerson {
  const p = DISCOVER_PEOPLE.find((x) => x.id === id);
  if (!p) throw new Error(`missing preview person ${id}`);
  return { ...p, district: null };
}

export function personLabel(p: DiscoverPerson): string {
  return p.age !== null ? `${p.name}, ${p.age}` : p.name;
}
