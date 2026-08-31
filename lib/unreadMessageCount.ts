import { supabase } from '@/lib/supabaseClient';

type UnreadListener = (count: number) => void;
const listeners = new Set<UnreadListener>();

export function onUnreadMessageCountChange(listener: UnreadListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Conversations with at least one unread message (receiver_id = me,
 * read_at IS NULL). Was a heuristic before ("was the last message sent to
 * me") — reading a conversation without replying kept it marked unread
 * forever, since nothing ever set a real read state (2026-08-31 fix,
 * migration 20260831100000). chat.tsx now marks messages read as they're
 * displayed.
 */
export async function fetchUnreadMessageCount(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: msgs, error } = await supabase
    .from('messages')
    .select('sender_id')
    .eq('receiver_id', user.id)
    .is('read_at', null);

  if (error || !msgs?.length) return 0;

  return new Set(msgs.map((m) => m.sender_id)).size;
}

export async function emitUnreadMessageCount(): Promise<number> {
  const count = await fetchUnreadMessageCount();
  listeners.forEach((l) => l(count));
  return count;
}
