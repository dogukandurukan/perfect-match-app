import { supabase } from '@/lib/supabaseClient';

type UnreadListener = (count: number) => void;
const listeners = new Set<UnreadListener>();

export function onUnreadMessageCountChange(listener: UnreadListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Conversations where the latest message was sent to the current user. */
export async function fetchUnreadMessageCount(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: msgs, error } = await supabase
    .from('messages')
    .select('sender_id, receiver_id, created_at')
    .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
    .order('created_at', { ascending: false });

  if (error || !msgs?.length) return 0;

  const seen = new Set<string>();
  let unread = 0;
  for (const msg of msgs) {
    const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
    if (seen.has(otherId)) continue;
    seen.add(otherId);
    if (msg.receiver_id === user.id) unread += 1;
  }
  return unread;
}

export async function emitUnreadMessageCount(): Promise<number> {
  const count = await fetchUnreadMessageCount();
  listeners.forEach((l) => l(count));
  return count;
}
