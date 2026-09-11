import { supabase } from '@/lib/supabaseClient';

// Fire-and-forget product-analytics event log (see supabase/migrations/
// 20260911130000_create_events.sql). Never awaited by callers, never throws,
// never blocks or alters app behavior on failure — an analytics gap is
// always preferable to a broken user action.
export function logEvent(name: string, properties: Record<string, unknown> = {}): void {
  void (async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('events').insert({
      user_id: user.id,
      name,
      properties,
    });
    if (error) console.warn(`[analytics] "${name}" failed`, error.message);
  })();
}
