// DEV-only Matches design preview (approved 3-screen direction, 2026-10-08):
// local fixtures + a pure state reducer. Nothing here reads or writes
// Supabase — no likes, messages or matches are created, and Reset only
// resets this in-memory state. The real Matches tab
// (components/main/V2MatchesScreen.tsx) is untouched.
//
// Rules mirrored from the brief:
//   • "Picked for you" = one person you haven't matched with (fixed
//     synthetic example — NOT chosen by any algorithm).
//   • "You both liked" = one mutual like, no message yet (fixed example).
//   • Targeted likes happen inside the profile (photo / prompt heart, or an
//     inline comment); one like per person; a like alone opens no chat.
//   • A message exists only after the user sends one; then the card says
//     "Conversation started" and the chat continues in Chats.
//   • No %, score, countdown, Plan a date, Ready to meet, Continue chatting
//     or last-message preview.
import { COMMENT_MAX, type DiscoverPerson } from '@/lib/discover/profileLayout';
import { DISCOVER_PEOPLE } from '@/lib/dev/discoverPreview';

export { COMMENT_MAX };

export type PreviewPersonKey = 'pick' | 'mutual';

export type SentLike = { target: string; comment: string };
export type PreviewMessage = { id: string; text: string };

export type PreviewState = {
  pick: { present: boolean; like: SentLike | null };
  mutual: { present: boolean; messages: PreviewMessage[] };
};

export const INITIAL_PREVIEW_STATE: PreviewState = {
  pick: { present: true, like: null },
  mutual: { present: true, messages: [] },
};

export type PreviewScenario = 'both' | 'no_mutual' | 'no_pick' | 'like_sent' | 'conversation_started';

export type PreviewAction =
  | { type: 'reset' }
  | { type: 'scenario'; scenario: PreviewScenario }
  | { type: 'send_like'; target: string; comment: string }
  | { type: 'send_message'; text: string };

/** Demo text used only by the DEV "Conversation started" shortcut. */
export const DEMO_FIRST_MESSAGE = 'Hi Ece! (demo message — not sent anywhere)';

export function previewReducer(s: PreviewState, a: PreviewAction): PreviewState {
  switch (a.type) {
    case 'reset':
      return INITIAL_PREVIEW_STATE;
    case 'scenario':
      switch (a.scenario) {
        case 'both':
          return INITIAL_PREVIEW_STATE;
        case 'no_mutual':
          return { pick: { present: true, like: null }, mutual: { present: false, messages: [] } };
        case 'no_pick':
          return { pick: { present: false, like: null }, mutual: { present: true, messages: [] } };
        case 'like_sent':
          return { ...s, pick: { present: true, like: { target: 'photo:0', comment: '' } } };
        case 'conversation_started':
          return { ...s, mutual: { present: true, messages: [{ id: 'local-1', text: DEMO_FIRST_MESSAGE }] } };
        default:
          return s;
      }
    case 'send_like': {
      // One like per person; a like (with or without a comment) never
      // touches the mutual card or creates a message.
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
  conversationStarted: 'Conversation started',
  conversationNote: 'Your conversation continues in Chats.',
  noPickTitle: 'No new pick right now',
  noPickText: 'Someone new picked for you will appear here.',
  noMutualTitle: 'No mutual likes yet',
  noMutualText: 'When you and someone both like each other, they’ll appear here.',
  chatEmptyTitle: (name: string) => `You and ${name} liked each other`,
  chatEmptyText: 'Say hello when you’re ready.',
  chatAfterFirst: 'Conversation started. It continues in Chats.',
  chatPlaceholder: 'Write a message…',
} as const;

/** Fixed synthetic people (the approved Discover preview fixtures). The
 * location follows the current server rule: no explicit "show my district"
 * choice exists, so the city is shown even though a district is filled. */
const fromDiscover = (id: string): DiscoverPerson => {
  const p = DISCOVER_PEOPLE.find((x) => x.id === id);
  if (!p) throw new Error(`missing preview person ${id}`);
  return { ...p, district: null };
};

export const PREVIEW_PEOPLE: Record<PreviewPersonKey, DiscoverPerson> = {
  pick: fromDiscover('defne'),
  mutual: fromDiscover('ece'),
};

export function personLabel(p: DiscoverPerson): string {
  return p.age !== null ? `${p.name}, ${p.age}` : p.name;
}
