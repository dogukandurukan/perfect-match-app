// Screen: Vibe kategori detayı | Status: stable | Last updated: Mayıs 2026
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { DailyLimitEmptyState } from '@/components/DailyLimitEmptyState';
import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import {
  DAILY_VIEW_LIMIT,
  getDailyViewsState,
  incrementDailyViews,
  type DailyViewsState,
} from '@/lib/dailyViews';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';
import {
  fetchBlockedUserIds,
  fetchMyVibeContext,
  fetchVibeCategoryUsers,
  getVibeCategoryById,
  type VibeCategoryId,
  type VibeListUser,
} from '@/lib/vibeCategories';

const ACCENT = '#B8860B';

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? '';
  return value ?? '';
}

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

function isVibeCategoryId(value: string): value is VibeCategoryId {
  return [
    'district',
    'night_owls',
    'early_birds',
    'weekend_coffee',
    'music_soul',
    'gaming',
    'reading',
    'recharge',
  ].includes(value);
}

export default function VibeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ categoryId?: string | string[] }>();
  const categoryIdRaw = firstParam(params.categoryId);
  const categoryId = isVibeCategoryId(categoryIdRaw) ? categoryIdRaw : null;
  const category = categoryId ? getVibeCategoryById(categoryId) : undefined;

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<VibeListUser[]>([]);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string | null>>({});
  const [dailyViews, setDailyViews] = useState<DailyViewsState | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!categoryId) {
        setLoading(false);
        return;
      }

      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !mounted) {
        setLoading(false);
        return;
      }

      setCurrentUserId(user.id);

      const [me, blockedIds, viewsState] = await Promise.all([
        fetchMyVibeContext(user.id),
        fetchBlockedUserIds(user.id),
        getDailyViewsState(user.id),
      ]);

      if (!mounted) return;

      setDailyViews(viewsState);

      if (!me) {
        setUsers([]);
        setLoading(false);
        return;
      }

      const rows = await fetchVibeCategoryUsers(categoryId, me, blockedIds);
      if (!mounted) return;

      setUsers(rows);

      const photoEntries = await Promise.all(
        rows.map(async (row) => {
          const path = row.photos?.[0];
          if (!path) return [row.id, null] as const;
          const url = await resolveProfilePhotoUrl(path, 3600);
          return [row.id, url] as const;
        }),
      );

      if (mounted) {
        setPhotoUrls(Object.fromEntries(photoEntries));
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [categoryId]);

  const handleUserPress = async (userId: string) => {
      if (!currentUserId) return;

      if (dailyViews?.limitReached) {
        Alert.alert(
          'Günlük limit',
          `Bugün en fazla ${DAILY_VIEW_LIMIT} profil görüntüleyebilirsin.`,
        );
        return;
      }

      const nextState = await incrementDailyViews(currentUserId);
      if (nextState) setDailyViews(nextState);

      router.push({
        pathname: '/user-profile',
        params: { userId },
      } as Parameters<typeof router.push>[0]);
  };

  if (!category) {
    return (
      <ScreenContainer style={styles.container}>
        <Stack.Screen options={{ title: 'Vibe', headerShown: true }} />
        <View style={styles.centerWrap}>
          <ThemedText style={styles.errorText}>Kategori bulunamadı.</ThemedText>
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer style={styles.container}>
      <Stack.Screen
        options={{
          title: `${category.emoji} ${category.title}`,
          headerShown: true,
        }}
      />

      {loading ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      ) : dailyViews?.limitReached ? (
        <DailyLimitEmptyState resetAt={dailyViews.resetAt} />
      ) : users.length === 0 ? (
        <View style={styles.centerWrap}>
          <ThemedText style={styles.emptyTitle}>Henüz kimse yok</ThemedText>
          <ThemedText style={styles.emptySubtitle}>
            Bu kategoride uygun profil bulunamadı.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const age = safeAge(item.date_of_birth);
            const photoUrl = photoUrls[item.id];
            const location = item.district ?? item.city ?? '—';

            return (
              <TouchableOpacity
                style={styles.userRow}
                activeOpacity={0.85}
                onPress={() => handleUserPress(item.id)}>
                {photoUrl ? (
                  <Image source={{ uri: photoUrl }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={styles.avatarPlaceholder} />
                )}
                <View style={styles.userInfo}>
                  <ThemedText style={styles.userName}>
                    {item.first_name ?? 'Kullanıcı'}
                    {age > 0 ? `, ${age}` : ''}
                  </ThemedText>
                  <ThemedText style={styles.userDistrict}>📍 {location}</ThemedText>
                </View>
                {item.match_percentage != null ? (
                  <View style={styles.matchBadge}>
                    <ThemedText style={styles.matchBadgeText}>%{item.match_percentage}</ThemedText>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-start',
    backgroundColor: '#F5F5F5',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    color: colors.textPrimary,
    fontSize: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 10,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    gap: 12,
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DDDDDD',
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DDDDDD',
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  userDistrict: {
    fontSize: 13,
    color: '#888888',
  },
  matchBadge: {
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  matchBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
