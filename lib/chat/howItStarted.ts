// Pure text for the chat's "How it started" card (components/chat/HowItStartedCard.tsx).
import type { LikeContext } from '@/lib/matchChatV2';

/** The one-line preview under the like line: the comment first (quoted), else the liked answer. */
export function likePreview(l: Pick<LikeContext, 'note' | 'answer'>): string | null {
  if (l.note && l.note.trim()) return `“${l.note.trim()}”`;
  if (l.answer && l.answer.trim()) return l.answer.trim();
  return null;
}
