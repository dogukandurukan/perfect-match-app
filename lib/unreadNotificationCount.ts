import { supabase } from '@/lib/supabaseClient';

type UnreadListener = (count: number) => void;
const listeners = new Set<UnreadListener>();

export function onUnreadNotificationCountChange(listener: UnreadListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) return 0;
  return count ?? 0;
}

export async function emitUnreadNotificationCount(): Promise<number> {
  const count = await fetchUnreadNotificationCount();
  listeners.forEach((l) => l(count));
  return count;
}
