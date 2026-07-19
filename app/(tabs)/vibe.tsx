// Screen: Vibe sekmesi | Status: stable | Last updated: Mayıs 2026
import { Image } from 'expo-image';
import { useCallback, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';
import {
  fetchAllVibeStrips,
  fetchBlockedUserIds,
  fetchMyVibeContext,
  VIBE_CATEGORIES,
  type VibeStripData,
  type VibeStripUser,
} from '@/lib/vibeCategories';

const ACCENT = '#B8860B';
const CARD_WIDTH = 140;
const CARD_HEIGHT = 200;
const CARD_GAP = 10;
const STRIP_PADDING = 16;
const SKELETON_CARD_COUNT = 4;

function safeAge(dob: string | null): number {
  if (!dob) return 0;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return Math.max(0, age);
}

function VibePersonCard({
  user,
  onPress,
}: {
  user: VibeStripUser;
  onPress: (userId: string) => void;
}) {
  const age = safeAge(user.date_of_birth);
  const nameLine = [user.first_name ?? 'Kullanıcı', age > 0 ? String(age) : null]
    .filter(Boolean)
    .join(', ');

  return (
    <TouchableOpacity
      style={styles.personCard}
      activeOpacity={0.85}
      onPress={() => onPress(user.id)}>
      <View style={styles.personPhotoWrap}>
        {user.photoUrl ? (
          <Image source={{ uri: user.photoUrl }} style={styles.personPhoto} contentFit="cover" />
        ) : (
          <View style={styles.personPhotoPlaceholder} />
        )}
      </View>
      <View style={styles.personInfo}>
        <ThemedText style={styles.personName} numberOfLines={1}>
          {nameLine}
        </ThemedText>
        <ThemedText style={styles.personDistrict} numberOfLines={1}>
          📍 {user.district ?? '—'}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );
}

function VibeCategoryStrip({
  strip,
  onUserPress,
}: {
  strip: VibeStripData;
  onUserPress: (userId: string) => void;
}) {
  const { category, totalCount, users } = strip;

  return (
    <View style={styles.strip}>
      <View style={styles.stripHeader}>
        <ThemedText style={styles.stripTitle}>
          {category.emoji} {category.title}
        </ThemedText>
        <View style={styles.stripHeaderRight}>
          <View style={styles.countBadge}>
            <ThemedText style={styles.countBadgeText}>{totalCount} kişi</ThemedText>
          </View>
          <ThemedText style={styles.seeAll}>Tümünü gör →</ThemedText>
        </View>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripListContent}
        renderItem={({ item }) => <VibePersonCard user={item} onPress={onUserPress} />}
      />
    </View>
  );
}

function VibeStripSkeleton() {
  return (
    <View style={styles.strip}>
      <View style={styles.skeletonHeader}>
        <View style={styles.skeletonTitle} />
        <View style={styles.skeletonBadge} />
      </View>
      <View style={styles.skeletonRow}>
        {Array.from({ length: SKELETON_CARD_COUNT }).map((_, index) => (
          <View key={`skeleton-${index}`} style={styles.skeletonCard} />
        ))}
      </View>
    </View>
  );
}

export default function VibeTab() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [strips, setStrips] = useState<VibeStripData[]>([]);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      (async () => {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !mounted) {
          setLoading(false);
          return;
        }

        const [me, blockedIds] = await Promise.all([
          fetchMyVibeContext(user.id),
          fetchBlockedUserIds(user.id),
        ]);

        if (!mounted) return;

        if (!me) {
          setStrips([]);
          setLoading(false);
          return;
        }

        const loadedStrips = await fetchAllVibeStrips(me, blockedIds);
        if (mounted) {
          setStrips(loadedStrips);
          setLoading(false);
        }
      })();

      return () => {
        mounted = false;
      };
    }, []),
  );

  function handleUserPress(userId: string) {
    router.push({
      pathname: '/user-profile',
      params: { userId },
    } as Parameters<typeof router.push>[0]);
  }

  return (
    <ScreenContainer style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.pageTitle}>Vibe ✨</ThemedText>

        {loading ? (
          <View style={styles.stripsWrap}>
            {VIBE_CATEGORIES.map((category) => (
              <VibeStripSkeleton key={category.id} />
            ))}
          </View>
        ) : strips.length === 0 ? (
          <View style={styles.emptyWrap}>
            <ThemedText style={styles.emptyText}>
              Yakında daha fazla kişi burada görünecek 🌟
            </ThemedText>
          </View>
        ) : (
          <View style={styles.stripsWrap}>
            {strips.map((strip) => (
              <VibeCategoryStrip key={strip.category.id} strip={strip} onUserPress={handleUserPress} />
            ))}
          </View>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const cardShadow = {
  shadowColor: '#000000',
  shadowOpacity: 0.08,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-start',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  content: {
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  stripsWrap: {
    gap: 24,
  },
  strip: {
    gap: 12,
  },
  stripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: STRIP_PADDING,
    gap: 8,
  },
  stripTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  stripHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countBadge: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  seeAll: {
    fontSize: 12,
    color: '#999999',
  },
  stripListContent: {
    paddingLeft: STRIP_PADDING,
    paddingRight: STRIP_PADDING,
  },
  personCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: CARD_GAP,
    ...cardShadow,
  },
  personPhotoWrap: {
    height: '70%',
    backgroundColor: '#DDDDDD',
  },
  personPhoto: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  personPhotoPlaceholder: {
    flex: 1,
    backgroundColor: '#DDDDDD',
  },
  personInfo: {
    height: '30%',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
    gap: 2,
  },
  personName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  personDistrict: {
    fontSize: 11,
    color: '#888888',
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: STRIP_PADDING,
  },
  skeletonTitle: {
    width: 160,
    height: 18,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
  },
  skeletonBadge: {
    width: 56,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#E0E0E0',
  },
  skeletonRow: {
    flexDirection: 'row',
    paddingLeft: STRIP_PADDING,
    gap: CARD_GAP,
  },
  skeletonCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 12,
    backgroundColor: '#E8E8E8',
  },
  emptyWrap: {
    paddingHorizontal: 32,
    paddingTop: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#888888',
    textAlign: 'center',
    lineHeight: 24,
  },
});
