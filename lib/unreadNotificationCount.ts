import { supabase } from '@/lib/supabaseClient';

type UnreadListener = (count: number) => void;
const listeners = new Set<UnreadListener>();

export function onUnreadNotificationCountChange(listener: UnreadListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Mirrors notifications.tsx's LIKE_TYPES — those rows are permanently
// filtered out of the Activity feed (the like teaser is sourced from
// get_my_likers instead) and nothing ever marks them read, so they must
// also be excluded here or the tab badge stays red forever regardless of
// what the user actually has left to look at (found 2026-09-12: 200+
// unread `new_match` rows, written on every background discovery-card
// insert, none ever shown or actionable).
const HIDDEN_FROM_BADGE = '(like,new_like,someone_liked,new_match)';

export async function fetchUnreadNotificationCount(): Promise<number> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_read', false)
    .not('type', 'in', HIDDEN_FROM_BADGE);

  if (error) return 0;
  return count ?? 0;
}

export async function emitUnreadNotificationCount(): Promise<number> {
  const count = await fetchUnreadNotificationCount();
  listeners.forEach((l) => l(count));
  return count;
}
