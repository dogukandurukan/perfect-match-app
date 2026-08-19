// Screen: Hey tab (activity + likes teaser) | Status: test | Last updated: Ağustos 2026
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { ErrorState } from '@/components/ErrorState';
import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors, radius } from '@/lib/designTokens';
import { formatRelativeTime } from '@/lib/labels';
import { acceptMatchInvite } from '@/lib/matchInvite';
import { emitUnreadNotificationCount } from '@/lib/unreadNotificationCount';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';
import { supabase } from '@/lib/supabaseClient';

type NotificationType = string;

type NotificationRow = {
  id: string;
  type: NotificationType;
  text: string;
  is_read: boolean;
  related_user_id: string | null;
  created_at: string;
  relatedName: string | null;
};

// A single row from the `get_my_likers` RPC. Non-premium callers get every
// identity field back as null (server-side gate) — only `totalCount` is safe
// to use unconditionally.
type LikerRow = {
  likerId: string | null;
  firstName: string | null;
  photoPath: string | null;
  targetType: string | null;
  targetKey: string | null;
  note: string | null;
  createdAt: string;
};

// Resolved-for-render version of a premium (unlocked) liker tile.
type UnlockedLiker = { likerId: string; firstName: string | null; photoUrl: string | null };

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type IconSpec = { name: IoniconName; color: string; bg: string };

// --- Notification classification (single source of truth) --------------------
// Phase B: the LIKE teaser (count + avatars) is now sourced from the real
// `likes` table via `get_my_likers`, not from `notifications`. These types are
// kept only to filter any legacy like-flavored notification rows out of the
// compact feed, so they don't show twice.
const LIKE_TYPES = new Set(['like', 'new_like', 'someone_liked', 'new_match']);
const FEATURED_TYPES = new Set(['invite_accepted', 'new_invite', 'meeting_invite']);
const isLikeType = (t: NotificationType) => LIKE_TYPES.has(t);
const isFeaturedType = (t: NotificationType) => FEATURED_TYPES.has(t);

// Blurred face tiles shown before the "+N" counter tile in the likes strip.
const LIKE_FACE_TILES = 3;

function typeIcon(type: NotificationType): IconSpec {
  switch (type) {
    case 'new_message':
    case 'message':
      return { name: 'chatbubble-ellipses', color: '#3B7DD8', bg: '#E6EEFB' };
    case 'checkin':
    case 'check_in':
    case 'post_date':
      return { name: 'location', color: '#0FA3A3', bg: '#E0F5F5' };
    case 'match_expiring':
    case 'match_expiry':
    case 'expires_soon':
      return { name: 'hourglass', color: '#E08A00', bg: '#FCEFD6' };
    default:
      return { name: 'notifications', color: colors.textMuted, bg: '#F0F0F0' };
  }
}

// Compact feed rows only handle non-like, non-featured types.
function feedRowText(type: NotificationType, name: string | null): string {
  const who = name?.trim() || 'Someone';
  switch (type) {
    case 'new_message':
    case 'message':
      return `${who} sent you a message`;
    case 'checkin':
    case 'check_in':
    case 'post_date':
      return `How did it go with ${who}?`;
    case 'match_expiring':
    case 'match_expiry':
    case 'expires_soon':
      return `Your match with ${who} expires soon`;
    default:
      return 'New notification';
  }
}

// `invite_accepted`/message types deep-link straight into that person's chat
// (not just the Chats list — otherwise "Pick time" dumps you on the list and
// you have to find them again). Falls back to the list when we don't know who.
function routeForType(
  item: NotificationRow,
): { pathname: string; params?: Record<string, string> } {
  switch (item.type) {
    case 'invite_accepted':
    case 'new_message':
    case 'message':
      return item.related_user_id
        ? {
            pathname: '/chat',
            params: { userId: item.related_user_id, userName: item.relatedName ?? '' },
          }
        : { pathname: '/(tabs)/messages' };
    default:
      return { pathname: '/(tabs)/matches' };
  }
}

// --- Premium "Likes You" teaser ---------------------------------------------
// Locked (free): count only, from `get_my_likers.total_count` — the RPC gates
// identity server-side, so there is no photo/name to render here at all
// (previously this blurred a real photo client-side, which still leaked the
// liker's identity to anyone inspecting the response; anonymous tiles fix that).
// Unlocked (premium): RPC returns real liker_id/first_name/photo_path — tiles
// show the real (unblurred) photo and are tappable straight to their profile.
function LikesSection({
  count,
  unlocked,
  likers,
  onPressLocked,
  onPressLiker,
}: {
  count: number;
  unlocked: boolean;
  likers: UnlockedLiker[];
  onPressLocked: () => void;
  onPressLiker: (likerId: string) => void;
}) {
  if (count <= 0) return null;
  const title = count === 1 ? '1 person likes you' : `${count} people like you`;

  if (!unlocked) {
    const anonymousTiles = Math.min(count, LIKE_FACE_TILES);
    const remainder = count - anonymousTiles;
    return (
      <TouchableOpacity
        style={styles.likes}
        onPress={onPressLocked}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={`${title}. Unlock to see who.`}>
        <ThemedText style={styles.likesTitle}>{title}</ThemedText>
        <ThemedText style={styles.likesSub}>Someone new is into you — unlock to see who</ThemedText>

        <View style={styles.likesStrip}>
          {Array.from({ length: anonymousTiles }).map((_, i) => (
            <View key={i} style={[styles.likeTile, styles.likeTileFallback]}>
              <Ionicons name="heart" size={22} color="#B8860B" />
            </View>
          ))}
          {remainder > 0 ? (
            <View style={[styles.likeTile, styles.likeTileMore]}>
              <ThemedText style={styles.likeTileMoreText}>+{remainder}</ThemedText>
            </View>
          ) : null}
        </View>

        <View style={styles.likesUnlock}>
          <Ionicons name="lock-closed" size={15} color="#FFFFFF" />
          <ThemedText style={styles.likesUnlockText}>Unlock to see who likes you</ThemedText>
        </View>
      </TouchableOpacity>
    );
  }

  const faces = likers.slice(0, LIKE_FACE_TILES);
  const remainder = count - faces.length;
  const unlockedTitle =
    count === 1 && faces[0]?.firstName ? `${faces[0].firstName} likes you` : title;

  return (
    <View style={styles.likes}>
      <ThemedText style={styles.likesTitle}>{unlockedTitle}</ThemedText>
      <ThemedText style={styles.likesSub}>Tap someone to see their profile</ThemedText>

      <View style={styles.likesStrip}>
        {faces.map((liker) => (
          <TouchableOpacity
            key={liker.likerId}
            style={styles.likeTile}
            onPress={() => onPressLiker(liker.likerId)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Open ${liker.firstName ?? 'their'} profile`}>
            {liker.photoUrl ? (
              <Image
                source={{ uri: liker.photoUrl }}
                style={styles.likeTileImg}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={[styles.likeTileImg, styles.likeTileFallback]}>
                <ThemedText style={styles.likeTileInitial}>
                  {(liker.firstName ?? '♥').charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}
          </TouchableOpacity>
        ))}
        {remainder > 0 ? (
          <View style={[styles.likeTile, styles.likeTileMore]}>
            <ThemedText style={styles.likeTileMoreText}>+{remainder}</ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// --- Zero-activity empty state: activation checklist, not a fake/blank screen --
// UI-3 (CLAUDE.md §4/§5): no fake likes on 0-state — show a real, actionable path
// (profile completeness) instead of "nothing here yet".
type ActivationChecklist = { hasPhoto: boolean; hasPrompt: boolean; hasSentLike: boolean };

function BuzzActivationCard({
  checklist,
  onGoProfile,
  onGoHome,
}: {
  checklist: ActivationChecklist;
  onGoProfile: () => void;
  onGoHome: () => void;
}) {
  const items: { key: string; done: boolean; icon: IoniconName; label: string; onPress: () => void }[] = [
    { key: 'photo', done: checklist.hasPhoto, icon: 'camera-outline', label: 'Add a photo', onPress: onGoProfile },
    {
      key: 'prompt',
      done: checklist.hasPrompt,
      icon: 'chatbubble-ellipses-outline',
      label: 'Answer a prompt',
      onPress: onGoProfile,
    },
    { key: 'like', done: checklist.hasSentLike, icon: 'heart-outline', label: 'Send your first like', onPress: onGoHome },
  ];
  const doneCount = items.filter((i) => i.done).length;

  return (
    <View style={styles.activation}>
      <ThemedText style={styles.activationTitle}>Get your profile buzz-ready</ThemedText>
      <ThemedText style={styles.activationSub}>
        {doneCount}/{items.length} done — finish these and Buzz fills up here
      </ThemedText>
      <View style={styles.activationBar}>
        <View style={[styles.activationBarFill, { width: `${(doneCount / items.length) * 100}%` }]} />
      </View>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={styles.activationRow}
          onPress={item.onPress}
          disabled={item.done}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={item.label}
          accessibilityState={{ disabled: item.done }}>
          <Ionicons
            name={item.done ? 'checkmark-circle' : item.icon}
            size={20}
            color={item.done ? '#2E9E5B' : colors.textMuted}
          />
          <ThemedText style={[styles.activationRowText, item.done && styles.activationRowDone]}>
            {item.label}
          </ThemedText>
          {!item.done ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
        </TouchableOpacity>
      ))}
    </View>
  );
}

// --- Featured high-signal event (said yes / wants to meet) -------------------
// "Wants to meet" gets inline Accept/Not now — no detour through Matches to
// answer yes/no (that's the whole point of surfacing it here). "Said yes"
// still routes to chat via the single CTA — that flow is unchanged today.
function FeaturedCard({
  item,
  photoUrl,
  onPress,
  onAccept,
  onDecline,
  responding,
}: {
  item: NotificationRow;
  photoUrl: string | null;
  onPress: () => void;
  onAccept?: () => void;
  onDecline?: () => void;
  responding?: boolean;
}) {
  const name = item.relatedName?.trim() || 'Someone';
  const accepted = item.type === 'invite_accepted';
  const title = accepted ? `${name} said yes` : `${name} wants to meet`;
  const sub = accepted ? 'Pick a time to meet up' : 'Coffee invite';
  const badge: IconSpec = accepted
    ? { name: 'checkmark-circle', color: '#2E9E5B', bg: '#E4F5EA' }
    : { name: 'cafe', color: colors.accent, bg: '#FBF3DF' };

  return (
    <TouchableOpacity
      style={[styles.featured, !item.is_read && styles.featuredUnread]}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}>
      <View style={styles.featuredAvatarWrap}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.featuredAvatar} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.featuredAvatar, styles.featuredAvatarFallback]}>
            <ThemedText style={styles.featuredInitial}>{name.charAt(0).toUpperCase()}</ThemedText>
          </View>
        )}
        <View style={[styles.featuredBadge, { backgroundColor: badge.bg }]}>
          <Ionicons name={badge.name} size={14} color={badge.color} />
        </View>
      </View>

      <View style={styles.featuredBody}>
        <ThemedText style={styles.featuredTitle}>{title}</ThemedText>
        <ThemedText style={styles.featuredSub}>{sub}</ThemedText>
      </View>

      {accepted ? (
        <View style={[styles.featuredCta, styles.featuredCtaAccepted]}>
          <ThemedText style={styles.featuredCtaText}>Pick time</ThemedText>
        </View>
      ) : responding ? (
        <ActivityIndicator size="small" color={colors.accent} />
      ) : (
        <View style={styles.respondRow}>
          <TouchableOpacity
            style={styles.respondDecline}
            onPress={onDecline}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`Not now, ${name}`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.respondAccept}
            onPress={onAccept}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Accept ${name}'s invite`}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [photoById, setPhotoById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  // Buzz Faz B: real "who likes you" teaser, sourced from `get_my_likers` —
  // gated server-side, not derived from `notifications`. Fetch failures here
  // degrade the teaser to 0 (hidden) rather than blocking the whole screen,
  // same pattern as the old `intentRows` degrade (CLAUDE.md §0.5).
  const [likeCount, setLikeCount] = useState(0);
  const [likeUnlocked, setLikeUnlocked] = useState(false);
  const [likers, setLikers] = useState<UnlockedLiker[]>([]);

  const fetchLikers = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_my_likers');
    if (error || !data || data.length === 0) {
      if (error) console.warn('get_my_likers failed', error.message);
      setLikeCount(0);
      setLikeUnlocked(false);
      setLikers([]);
      return;
    }

    const rows = data as {
      total_count: number;
      liker_id: string | null;
      first_name: string | null;
      photo_path: string | null;
      created_at: string;
    }[];
    const unlocked = rows.some((r) => r.liker_id != null);
    setLikeCount(Number(rows[0]?.total_count ?? 0));
    setLikeUnlocked(unlocked);

    if (!unlocked) {
      setLikers([]);
      return;
    }

    const resolved = await Promise.all(
      rows
        .filter((r): r is typeof r & { liker_id: string } => r.liker_id != null)
        .slice(0, LIKE_FACE_TILES)
        .map(async (r) => {
          let photoUrl: string | null = null;
          if (r.photo_path) {
            try {
              photoUrl = await resolveProfilePhotoUrl(r.photo_path, 3600);
            } catch {
              /* skip broken photo */
            }
          }
          return { likerId: r.liker_id, firstName: r.first_name, photoUrl };
        }),
    );
    setLikers(resolved);
  }, []);

  // UI-3: activation checklist for the 0-activity empty state. Cheap (one
  // profiles row + one count query) so it's fetched every focus alongside the
  // rest — no separate gating on emptiness.
  const [checklist, setChecklist] = useState<ActivationChecklist>({
    hasPhoto: false,
    hasPrompt: false,
    hasSentLike: false,
  });

  const fetchChecklist = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data: prof }, { count: sentCount }] = await Promise.all([
      supabase
        .from('profiles')
        .select('photos, bio, first_date_expectation, favorite_spots')
        .eq('id', user.id)
        .maybeSingle(),
      supabase.from('likes').select('id', { count: 'exact', head: true }).eq('liker_id', user.id),
    ]);

    const spots = prof?.favorite_spots;
    const hasSpots =
      !!spots && typeof spots === 'object' && Object.keys(spots as Record<string, unknown>).length > 0;

    setChecklist({
      hasPhoto: Array.isArray(prof?.photos) && prof.photos.length > 0,
      hasPrompt: !!prof?.bio?.trim() || !!prof?.first_date_expectation?.trim() || hasSpots,
      hasSentLike: (sentCount ?? 0) > 0,
    });
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setItems([]);
      setPhotoById({});
      setLoading(false);
      await emitUnreadNotificationCount();
      return;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, text, is_read, related_user_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error || !data) {
      setItems([]);
      setPhotoById({});
      setError(true);
      setLoading(false);
      await emitUnreadNotificationCount();
      return;
    }

    const relatedIds = [
      ...new Set(
        data
          .map((row) => row.related_user_id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];

    const nameById = new Map<string, string>();
    const photosById = new Map<string, string[]>();
    if (relatedIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, photos')
        .in('id', relatedIds);
      for (const p of profiles ?? []) {
        if (typeof p.id === 'string') {
          if (typeof p.first_name === 'string') nameById.set(p.id, p.first_name);
          if (Array.isArray(p.photos)) photosById.set(p.id, p.photos as string[]);
        }
      }
    }

    const rows: NotificationRow[] = data.map((row) => ({
      id: row.id as string,
      type: String(row.type ?? ''),
      text: typeof row.text === 'string' ? row.text : '',
      is_read: row.is_read === true,
      related_user_id: typeof row.related_user_id === 'string' ? row.related_user_id : null,
      created_at: String(row.created_at),
      relatedName: row.related_user_id
        ? (nameById.get(row.related_user_id as string) ?? null)
        : null,
    }));
    setItems(rows);

    // Resolve photos for the featured card avatars only (like-grid photos
    // now come from `fetchLikers`, resolved separately above).
    const featuredIds = [
      ...new Set(
        rows
          .filter((r) => isFeaturedType(r.type))
          .map((r) => r.related_user_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];

    const urlById: Record<string, string> = {};
    await Promise.all(
      featuredIds.map(async (id) => {
        const firstPhoto = photosById.get(id)?.[0];
        if (!firstPhoto) return;
        try {
          const url = await resolveProfilePhotoUrl(firstPhoto, 3600);
          if (url) urlById[id] = url;
        } catch {
          /* skip broken photo */
        }
      }),
    );
    setPhotoById(urlById);

    setLoading(false);
    await emitUnreadNotificationCount();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchNotifications();
      void fetchLikers();
      void fetchChecklist();
    }, [fetchNotifications, fetchLikers, fetchChecklist]),
  );

  // Derived zones — recompute on items change (read-state edits included).
  // Featured excludes already-read items: once acted on (accept/decline) or
  // even just opened, it shouldn't keep reappearing at the top every time you
  // come back to Buzz — that was the "same card keeps coming back" bug.
  const { featured, feed } = useMemo(
    () => ({
      featured: items.filter((r) => isFeaturedType(r.type) && !r.is_read),
      feed: items.filter((r) => !isLikeType(r.type) && !isFeaturedType(r.type)),
    }),
    [items],
  );

  async function handlePress(item: NotificationRow) {
    if (!item.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
      );
      await emitUnreadNotificationCount();
    }
    router.push(routeForType(item) as never);
  }

  // Inline Accept/Not now on the "wants to meet" featured card — no detour
  // through Matches to answer yes/no. Mirrors matches.tsx's handleAccept
  // (acceptMatchInvite) and handleMaybeLater (local dismiss, no DB write —
  // matches.tsx doesn't persist a hard decline for incoming invites either,
  // so this stays consistent with that existing behavior).
  async function handleRespond(item: NotificationRow, accept: boolean) {
    if (!item.related_user_id) return;

    if (!accept) {
      setItems((prev) => prev.filter((n) => n.id !== item.id));
      await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
      await emitUnreadNotificationCount();
      return;
    }

    setRespondingId(item.id);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setRespondingId(null);
      return;
    }

    const otherId = item.related_user_id;
    const [{ data: match }, { data: genderRows }] = await Promise.all([
      supabase
        .from('matches')
        .select('id, invited_by, chat_opened, user_a_id, user_b_id')
        .or(
          `and(user_a_id.eq.${user.id},user_b_id.eq.${otherId}),` +
            `and(user_a_id.eq.${otherId},user_b_id.eq.${user.id})`,
        )
        .eq('status', 'pending')
        .maybeSingle(),
      supabase.from('profiles').select('id, gender').in('id', [user.id, otherId]),
    ]);

    if (!match) {
      setRespondingId(null);
      Alert.alert('Invite not found', 'This invite may have expired.');
      return;
    }

    const myGender = genderRows?.find((p) => p.id === user.id)?.gender ?? null;
    const otherGender = genderRows?.find((p) => p.id === otherId)?.gender ?? null;

    const result = await acceptMatchInvite({
      matchId: match.id,
      currentUserId: user.id,
      currentUserGender: myGender,
      otherUserGender: otherGender,
    });
    setRespondingId(null);

    if (!result.ok) {
      Alert.alert('Could not accept', result.error ?? 'Something went wrong.');
      return;
    }

    setItems((prev) => prev.filter((n) => n.id !== item.id));
    await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
    await emitUnreadNotificationCount();

    if (result.chatOpened) {
      router.push({
        pathname: '/chat',
        params: { userId: otherId, userName: item.relatedName ?? '', matchId: match.id },
      } as never);
    } else {
      // Accepted, but the chat doesn't open on this side yet (gender-pair rule
      // in shouldOpenChatOnAccept) — say so, otherwise the tap feels like it did
      // nothing.
      Alert.alert('Invite accepted', "You're in — the chat will open once it's their turn.");
    }
  }

  async function handleMarkAllRead() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    setMarkingAll(true);
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setMarkingAll(false);
    await emitUnreadNotificationCount();
  }

  function renderFeedRow({ item }: { item: NotificationRow }) {
    const icon = typeIcon(item.type);
    return (
      <TouchableOpacity
        style={[styles.row, !item.is_read && styles.rowUnread]}
        onPress={() => void handlePress(item)}
        activeOpacity={0.8}>
        <View style={[styles.rowIconWrap, { backgroundColor: icon.bg }]}>
          <Ionicons name={icon.name} size={18} color={icon.color} />
        </View>
        <View style={styles.rowContent}>
          <ThemedText style={styles.rowText}>{feedRowText(item.type, item.relatedName)}</ThemedText>
          <ThemedText style={styles.rowTime}>{formatRelativeTime(item.created_at)}</ThemedText>
        </View>
        {!item.is_read ? <View style={styles.unreadDot} /> : null}
      </TouchableOpacity>
    );
  }

  const hasUnread = items.some((n) => !n.is_read);

  // Top: high-signal event cards. Bottom (footer): the premium likes teaser.
  const ListHeader = (
    <View>
      {featured.map((item) => (
        <FeaturedCard
          key={item.id}
          item={item}
          photoUrl={item.related_user_id ? (photoById[item.related_user_id] ?? null) : null}
          onPress={() => void handlePress(item)}
          onAccept={() => void handleRespond(item, true)}
          onDecline={() => void handleRespond(item, false)}
          responding={respondingId === item.id}
        />
      ))}
      {featured.length > 0 && feed.length > 0 ? (
        <ThemedText style={styles.sectionLabel}>Earlier</ThemedText>
      ) : null}
    </View>
  );

  const ListFooter = (
    <LikesSection
      count={likeCount}
      unlocked={likeUnlocked}
      likers={likers}
      onPressLocked={() => router.push('/premium' as never)}
      onPressLiker={(likerId) =>
        router.push({ pathname: '/user-profile', params: { userId: likerId } } as never)
      }
    />
  );

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <View style={styles.headerRow}>
        <ThemedText style={styles.pageTitle}>Buzz</ThemedText>
        {hasUnread ? (
          <TouchableOpacity
            onPress={() => void handleMarkAllRead()}
            disabled={markingAll}
            activeOpacity={0.8}>
            <ThemedText style={styles.markAllBtn}>
              {markingAll ? '...' : 'Mark all as read'}
            </ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : error ? (
        <ErrorState onRetry={() => void fetchNotifications()} />
      ) : items.length === 0 && likeCount === 0 ? (
        <BuzzActivationCard
          checklist={checklist}
          onGoProfile={() => router.push('/(tabs)/profile' as never)}
          onGoHome={() => router.push('/(tabs)' as never)}
        />
      ) : (
        <FlatList
          data={feed}
          keyExtractor={(item) => item.id}
          renderItem={renderFeedRow}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  markAllBtn: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accent,
  },
  loader: { marginTop: 40 },
  list: { paddingBottom: 32 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 6,
    marginBottom: 8,
  },

  // --- Likes premium teaser (footer) ---
  likes: {
    backgroundColor: '#FFFBF0',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#EBD9A6',
    padding: 16,
    marginTop: 6,
  },
  likesTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  likesSub: {
    fontSize: 12.5,
    color: '#9A7B2E',
    marginTop: 2,
    marginBottom: 14,
  },
  likesStrip: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  likeTile: {
    flex: 1,
    maxWidth: 110,
    aspectRatio: 0.9,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#EDE2C2',
  },
  likeTileImg: { width: '100%', height: '100%' },
  likeTileFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E6D6A8',
  },
  likeTileInitial: {
    fontSize: 22,
    fontWeight: '800',
    color: '#B8860B',
  },
  likeTileMore: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  likeTileMoreText: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  likesUnlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  likesUnlockText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // --- Featured event card ---
  featured: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#EFE4C4',
    marginBottom: 10,
    shadowColor: '#8A6D1A',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  featuredUnread: {
    backgroundColor: '#FFFDF6',
    borderColor: '#EBD9A6',
  },
  featuredAvatarWrap: { width: 52, height: 52 },
  featuredAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#EEE',
  },
  featuredAvatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1E6C6',
  },
  featuredInitial: {
    fontSize: 20,
    fontWeight: '800',
    color: '#B8860B',
  },
  featuredBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  featuredBody: { flex: 1, gap: 3 },
  featuredTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  featuredSub: {
    fontSize: 13,
    color: colors.textMuted,
  },
  featuredCta: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  featuredCtaAccepted: {
    backgroundColor: '#2E9E5B',
  },
  featuredCtaText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  respondRow: { flexDirection: 'row', gap: 8 },
  respondDecline: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F0F0',
  },
  respondAccept: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E9E5B',
  },

  // --- Compact feed row ---
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  rowUnread: {
    backgroundColor: '#FFF8E1',
    borderColor: '#FFE082',
  },
  rowIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { flex: 1, gap: 4 },
  rowText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
    lineHeight: 21,
  },
  rowTime: {
    fontSize: 12,
    color: '#888',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginLeft: 4,
  },
  activation: {
    marginTop: 24,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: '#F0F0F0',
    padding: 18,
  },
  activationTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  activationSub: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
    marginBottom: 14,
  },
  activationBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F0F0F0',
    overflow: 'hidden',
    marginBottom: 16,
  },
  activationBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  activationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#F0F0F0',
  },
  activationRowText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  activationRowDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
});
