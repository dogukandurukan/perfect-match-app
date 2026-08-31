// Screen: Blocked users | Status: new | Last updated: Ağustos 2026
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ErrorState } from '@/components/ErrorState';
import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';
import { resolveProfilePhotoUrl } from '@/lib/userPhotosStorage';

const ACCENT = '#B8860B';

type BlockedUser = {
  blockId: string;
  userId: string;
  firstName: string | null;
  photoUrl: string | null;
};

export default function BlockedUsersScreen() {
  const router = useRouter();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      (async () => {
        setLoading(true);
        setError(false);

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || !mounted) {
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('blocks')
          .select('id, blocked_id')
          .eq('blocker_id', user.id)
          .order('created_at', { ascending: false });

        if (!mounted) return;
        if (fetchError) {
          console.warn('[BlockedUsers] fetch failed', fetchError);
          setError(true);
          setLoading(false);
          return;
        }

        const blockedIds = (data ?? []).map((row) => row.blocked_id as string);
        if (blockedIds.length === 0) {
          setUsers([]);
          setLoading(false);
          return;
        }

        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, first_name, photos')
          .in('id', blockedIds);

        const profileById = new Map(
          (profiles ?? []).map((p) => [p.id as string, p as { first_name: string | null; photos: string[] | null }]),
        );

        const resolved = await Promise.all(
          (data ?? []).map(async (row) => {
            const profile = profileById.get(row.blocked_id as string);
            const firstPhoto = profile?.photos?.[0];
            let photoUrl: string | null = null;
            if (firstPhoto) {
              try {
                photoUrl = await resolveProfilePhotoUrl(firstPhoto, 3600);
              } catch {
                /* skip broken photo */
              }
            }
            return {
              blockId: row.id as string,
              userId: row.blocked_id as string,
              firstName: profile?.first_name ?? null,
              photoUrl,
            };
          }),
        );

        if (mounted) {
          setUsers(resolved);
          setLoading(false);
        }
      })();
      return () => {
        mounted = false;
      };
    }, [reloadKey]),
  );

  function handleUnblock(item: BlockedUser) {
    Alert.alert('Unblock', `Unblock ${item.firstName ?? 'this person'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          setUnblockingId(item.blockId);
          const { error } = await supabase.from('blocks').delete().eq('id', item.blockId);
          setUnblockingId(null);
          if (error) {
            Alert.alert('Could not unblock', 'Please try again.');
            return;
          }
          setUsers((prev) => prev.filter((u) => u.blockId !== item.blockId));
        },
      },
    ]);
  }

  return (
    <ScreenContainer style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="chevron-back" size={24} color={ACCENT} />
        <ThemedText style={styles.backText}>Settings</ThemedText>
      </TouchableOpacity>
      <HomeTopIcon />

      <ThemedText type="title" style={styles.title}>
        Blocked users
      </ThemedText>

      {loading ? (
        <ActivityIndicator color={ACCENT} style={styles.loader} />
      ) : error ? (
        <ErrorState onRetry={() => setReloadKey((k) => k + 1)} />
      ) : users.length === 0 ? (
        <View style={styles.emptyWrap}>
          <ThemedText style={styles.emptyText}>You haven't blocked anyone.</ThemedText>
        </View>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.blockId}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <ThemedText style={styles.avatarInitial}>
                    {(item.firstName ?? '?').charAt(0).toUpperCase()}
                  </ThemedText>
                </View>
              )}
              <ThemedText style={styles.name}>{item.firstName ?? 'Someone'}</ThemedText>
              <TouchableOpacity
                style={styles.unblockBtn}
                onPress={() => handleUnblock(item)}
                disabled={unblockingId === item.blockId}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${item.firstName ?? 'this person'}`}>
                {unblockingId === item.blockId ? (
                  <ActivityIndicator size="small" color={ACCENT} />
                ) : (
                  <ThemedText style={styles.unblockText}>Unblock</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start', paddingTop: 8 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  backText: { color: ACCENT, fontSize: 16 },
  title: { color: ACCENT, fontSize: 24, marginTop: 12, marginBottom: 16 },
  loader: { marginTop: 40 },
  emptyWrap: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#888', fontSize: 15 },
  list: { paddingBottom: 32, gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    padding: 12,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#DDD' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#888', fontSize: 16, fontWeight: '700' },
  name: { flex: 1, fontSize: 15, color: colors.textPrimary, fontWeight: '500' },
  unblockBtn: {
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  unblockText: { color: ACCENT, fontSize: 13, fontWeight: '600' },
});
