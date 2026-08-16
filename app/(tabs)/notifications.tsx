// Screen: Hey tab (activity + likes teaser) | Status: test | Last updated: Ağustos 2026
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

// One blurred, locked liker card in the premium teaser grid.
type LikeAvatar = { url: string | null; initial: string };

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];
type IconSpec = { name: IoniconName; color: string; bg: string };

// --- Notification classification (single source of truth) --------------------
// Phase B will swap the LIKE source from `notifications` to the real `likes`
// table; keep the membership tests here so the rest of the screen is agnostic.
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

function routeForType(type: NotificationType): string {
  switch (type) {
    case 'invite_accepted':
    case 'new_message':
    case 'message':
      return '/(tabs)/messages';
    default:
      return '/(tabs)/matches';
  }
}

// --- Premium "Likes You" teaser ---------------------------------------------
// A 4-up strip: up to 3 blurred faces + a "+N" counter tile, then a full-width
// Unlock button. Reveals nothing (name/face) — that unlock is the premium hook.
// Phase B feeds this from the likes table and unblurs on premium.
function LikesSection({
  count,
  avatars,
  onPress,
}: {
  count: number;
  avatars: LikeAvatar[];
  onPress: () => void;
}) {
  if (count <= 0) return null;
  const faces = avatars.slice(0, LIKE_FACE_TILES);
  const remainder = count - faces.length; // count shown on the "+N" tile
  const title = count === 1 ? '1 person likes you' : `${count} people like you`;

  return (
    <TouchableOpacity
      style={styles.likes}
      onPress={onPress}
      activeOpacity={0.9}
      accessibilityRole="button"
      accessibilityLabel={`${title}. Unlock to see who.`}>
      <ThemedText style={styles.likesTitle}>{title}</ThemedText>
      <ThemedText style={styles.likesSub}>Someone new is into you — unlock to see who</ThemedText>

      <View style={styles.likesStrip}>
        {faces.map((a, i) => (
          <View key={i} style={styles.likeTile}>
            {a.url ? (
              <Image
                source={{ uri: a.url }}
                style={styles.likeTileImg}
                blurRadius={22}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <View style={[styles.likeTileImg, styles.likeTileFallback]}>
                <ThemedText style={styles.likeTileInitial}>{a.initial}</ThemedText>
              </View>
            )}
            <View style={styles.likeTileVeil} />
            <Ionicons name="heart" size={15} color="rgba(255,255,255,0.9)" style={styles.likeTileHeart} />
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

// --- Featured high-signal event (said yes / wants to meet) -------------------
function FeaturedCard({
  item,
  photoUrl,
  onPress,
}: {
  item: NotificationRow;
  photoUrl: string | null;
  onPress: () => void;
}) {
  const name = item.relatedName?.trim() || 'Someone';
  const accepted = item.type === 'invite_accepted';
  const title = accepted ? `${name} said yes` : `${name} wants to meet`;
  const sub = accepted ? 'Pick a time to meet up' : 'Coffee invite — tap to respond';
  const badge: IconSpec = accepted
    ? { name: 'checkmark-circle', color: '#2E9E5B', bg: '#E4F5EA' }
    : { name: 'cafe', color: colors.accent, bg: '#FBF3DF' };
  const cta = accepted ? 'Pick time' : 'Respond';

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

      <View style={[styles.featuredCta, accepted && styles.featuredCtaAccepted]}>
        <ThemedText style={styles.featuredCtaText}>{cta}</ThemedText>
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [likeAvatars, setLikeAvatars] = useState<LikeAvatar[]>([]);
  const [photoById, setPhotoById] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(false);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setItems([]);
      setLikeAvatars([]);
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
      setLikeAvatars([]);
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

    // Resolve photos for: blurred like grid + featured card avatars.
    const likerIds = [
      ...new Set(
        rows
          .filter((r) => isLikeType(r.type))
          .map((r) => r.related_user_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];
    const featuredIds = [
      ...new Set(
        rows
          .filter((r) => isFeaturedType(r.type))
          .map((r) => r.related_user_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];
    const gridIds = likerIds.slice(0, LIKE_FACE_TILES);
    const idsToResolve = [...new Set([...gridIds, ...featuredIds])];

    const urlById: Record<string, string> = {};
    await Promise.all(
      idsToResolve.map(async (id) => {
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

    setLikeAvatars(
      gridIds.map((id) => ({
        url: urlById[id] ?? null,
        initial: (nameById.get(id) ?? '♥').charAt(0).toUpperCase() || '♥',
      })),
    );

    setLoading(false);
    await emitUnreadNotificationCount();
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchNotifications();
    }, [fetchNotifications]),
  );

  // Derived zones — recompute on items change (read-state edits included).
  const { likeCount, featured, feed } = useMemo(() => {
    const likeRows = items.filter((r) => isLikeType(r.type));
    const likerIds = [
      ...new Set(
        likeRows
          .map((r) => r.related_user_id)
          .filter((id): id is string => typeof id === 'string'),
      ),
    ];
    return {
      likeCount: likerIds.length > 0 ? likerIds.length : likeRows.length,
      featured: items.filter((r) => isFeaturedType(r.type)),
      feed: items.filter((r) => !isLikeType(r.type) && !isFeaturedType(r.type)),
    };
  }, [items]);

  async function handlePress(item: NotificationRow) {
    if (!item.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', item.id);
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)),
      );
      await emitUnreadNotificationCount();
    }
    router.push(routeForType(item.type) as never);
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
      avatars={likeAvatars}
      onPress={() => router.push('/premium' as never)}
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
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <ThemedText style={styles.emptyText}>Nothing yet</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            When someone likes you or wants to meet, it&apos;ll show up here
          </ThemedText>
        </View>
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
  likeTileVeil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(120,90,10,0.20)',
  },
  likeTileHeart: {
    position: 'absolute',
    bottom: 6,
    right: 6,
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
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
});
