import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { activityBadge } from '@/lib/activity/badge';
import { supabase } from '@/lib/supabaseClient';

/**
 * V2 Activity tab badge (unseen pending likes). One instance (the Activity tab
 * icon) owns the listeners: first refresh on mount, app back in the
 * foreground → refresh, auth change → clear the previous account's count at
 * once, then refresh for the new one.
 */
export function useActivityBadge(enabled: boolean): number {
  const [count, setCount] = useState(activityBadge.value);
  useEffect(() => {
    if (!enabled) return;
    const unsub = activityBadge.subscribe(setCount);
    void activityBadge.refresh();
    const app = AppState.addEventListener('change', (st) => {
      if (st === 'active') void activityBadge.refresh();
    });
    const { data: auth } = supabase.auth.onAuthStateChange((_event, session) => {
      activityBadge.accountChanged(session?.user?.id ?? null);
      if (session?.user) void activityBadge.refresh();
    });
    return () => {
      unsub();
      app.remove();
      auth.subscription.unsubscribe();
    };
  }, [enabled]);
  return enabled ? count : 0;
}
