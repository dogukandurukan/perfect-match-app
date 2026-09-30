// Screen: Blocked users | Status: new | Last updated: Ağustos 2026
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { ErrorState } from '@/components/ErrorState';
import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';

const ACCENT = '#1A1A1A';

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
          data: { session },
        } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user || !mounted) {
          setLoading(false);
          return;
        }

        // get_my_blocked_users (P0): only what the unblock list needs — block
        // id, their id and first name. No photo and no profile access after a
        // block (profile_cards hides blocked people in both directions).
        const { data, error: fetchError } = await supabase.rpc('get_my_blocked_users');

        if (!mounted) return;
        if (fetchError) {
          console.warn('[BlockedUsers] fetch failed', fetchError);
          setError(true);
          setLoading(false);
          return;
        }

        const rows = (data ?? []) as { block_id: string; blocked_id: string; first_name: string | null }[];
        const resolved = rows.map((row) => ({
          blockId: row.block_id,
          userId: row.blocked_id,
          firstName: row.first_name,
          photoUrl: null as string | null,
        }));

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
  container: { justifyContent: 'flex-start' },
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
