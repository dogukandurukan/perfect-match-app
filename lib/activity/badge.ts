// Activity tab badge for V2 (app wiring of ActivityBadgeStore): unseen pending
// likes from get_my_activity_v2. Refreshed on events only — tab focus, app
// foreground, opening a liker's profile, Match & chat, account change — no
// polling (likes are not on the Realtime feed).
import { loadActivity, unseenLikeCount, type ActivityData } from '@/lib/activity/activityV2';
import { ActivityBadgeStore } from '@/lib/activity/badgeStore';
import { supabase } from '@/lib/supabaseClient';

const currentUserId = async () => (await supabase.auth.getSession()).data.session?.user?.id ?? null;

export const activityBadge = new ActivityBadgeStore({
  currentUserId,
  loadCount: async () => {
    const r = await loadActivity();
    return r.kind === 'ok' ? { ok: true, count: unseenLikeCount(r.value) } : { ok: false };
  },
});

/** The Activity screen already loaded the snapshot: publish without a second fetch. */
export function publishActivityBadge(d: ActivityData): void {
  void activityBadge.publish(unseenLikeCount(d));
}
