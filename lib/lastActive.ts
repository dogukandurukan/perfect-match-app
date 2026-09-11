import { supabase } from '@/lib/supabaseClient';

/** Lightweight "seen today" heartbeat — backs the "Active today" Advanced
 * filter (get_top_matches). Fire-and-forget, once per app session (see
 * LocationBridge in app/_layout.tsx, same trigger point as location/push
 * token saves). Not throttled further — one write per cold/warm start is
 * cheap and a good enough proxy for "opened the app today". */
export async function updateLastActive(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ last_active_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) console.warn('[lastActive] update failed', error.message);
}
