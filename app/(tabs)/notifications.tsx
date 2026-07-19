// Screen: Bildirimler tab | Status: test | Last updated: Mayıs 2026
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HomeTopIcon } from '@/components/ui/HomeTopIcon';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { emitUnreadNotificationCount } from '@/lib/unreadNotificationCount';
import { supabase } from '@/lib/supabaseClient';

type NotificationType = 'new_match' | 'new_invite' | 'invite_accepted';

type NotificationRow = {
  id: string;
  type: NotificationType;
  text: string;
  is_read: boolean;
  related_user_id: string | null;
  created_at: string;
};

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (minutes < 5) return 'Az önce';
  if (hours < 1) return `${minutes} dakika önce`;
  if (hours < 24) return `${hours} saat önce`;
  return `${days} gün önce`;
}

function typeIcon(type: NotificationType): string {
  switch (type) {
    case 'new_match':
      return '✨';
    case 'new_invite':
      return '☕';
    case 'invite_accepted':
      return '🎉';
    default:
      return '🔔';
  }
}

function routeForType(type: NotificationType): string {
  switch (type) {
    case 'new_match':
    case 'new_invite':
      return '/(tabs)/matches';
    case 'invite_accepted':
      return '/(tabs)/messages';
    default:
      return '/(tabs)/notifications';
  }
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setItems([]);
      setLoading(false);
      await emitUnreadNotificationCount();
      return;
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, text, is_read, related_user_id, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setItems(data as NotificationRow[]);
    } else {
      setItems([]);
    }

    setLoading(false);
    await emitUnreadNotificationCount();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications]),
  );

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

  function renderItem({ item }: { item: NotificationRow }) {
    return (
      <TouchableOpacity
        style={[styles.row, !item.is_read && styles.rowUnread]}
        onPress={() => handlePress(item)}
        activeOpacity={0.8}>
        <ThemedText style={styles.rowIcon}>{typeIcon(item.type)}</ThemedText>
        <View style={styles.rowContent}>
          <ThemedText style={styles.rowText}>{item.text}</ThemedText>
          <ThemedText style={styles.rowTime}>{timeAgo(item.created_at)}</ThemedText>
        </View>
      </TouchableOpacity>
    );
  }

  const hasUnread = items.some((n) => !n.is_read);

  return (
    <ScreenContainer style={styles.container}>
      <HomeTopIcon />
      <View style={styles.headerRow}>
        <ThemedText style={styles.pageTitle}>Bildirimler 🔔</ThemedText>
        {hasUnread ? (
          <TouchableOpacity
            onPress={handleMarkAllRead}
            disabled={markingAll}
            activeOpacity={0.8}>
            <ThemedText style={styles.markAllBtn}>
              {markingAll ? '...' : 'Tümünü okundu işaretle'}
            </ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accent} style={styles.loader} />
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <ThemedText style={styles.emptyText}>Henüz bildirim yok</ThemedText>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  rowIcon: {
    fontSize: 24,
    marginTop: 2,
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
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
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
  },
});
