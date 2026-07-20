// Screen: Messages tab | Status: test | Last updated: Mayıs 2026
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { formatRelativeTime } from '@/lib/labels';
import { supabase } from '@/lib/supabaseClient';

const EMPTY_CHAT_PREVIEW = 'You matched — say hi 👋';

type Conversation = {
  userId: string;
  userName: string;
  lastMessage: string;
  lastAt: string;
  matchId: string | null;
};

export default function MessagesScreen() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);

    const [{ data: msgs }, { data: openMatches }] = await Promise.all([
      supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at')
        .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
        .order('created_at', { ascending: false }),
      supabase
        .from('matches')
        .select('id, user_a_id, user_b_id, chat_opened, created_at, expires_at')
        .or(`user_a_id.eq.${currentUserId},user_b_id.eq.${currentUserId}`)
        .eq('chat_opened', true),
    ]);

    const byOther = new Map<string, Conversation>();

    for (const msg of msgs ?? []) {
      const otherId =
        msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
      if (typeof otherId !== 'string' || byOther.has(otherId)) continue;

      byOther.set(otherId, {
        userId: otherId,
        userName: 'Someone',
        lastMessage: typeof msg.content === 'string' ? msg.content : '',
        lastAt: String(msg.created_at),
        matchId: null,
      });
    }

    for (const row of openMatches ?? []) {
      const otherId =
        row.user_a_id === currentUserId ? row.user_b_id : row.user_a_id;
      if (typeof otherId !== 'string') continue;

      const existing = byOther.get(otherId);
      if (existing) {
        existing.matchId = typeof row.id === 'string' ? row.id : existing.matchId;
        continue;
      }

      const stamp =
        (typeof row.created_at === 'string' && row.created_at) ||
        (typeof row.expires_at === 'string' && row.expires_at) ||
        new Date().toISOString();

      byOther.set(otherId, {
        userId: otherId,
        userName: 'Someone',
        lastMessage: EMPTY_CHAT_PREVIEW,
        lastAt: stamp,
        matchId: typeof row.id === 'string' ? row.id : null,
      });
    }

    const otherIds = [...byOther.keys()];
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name')
        .in('id', otherIds);

      for (const p of profiles ?? []) {
        if (typeof p.id !== 'string') continue;
        const conv = byOther.get(p.id);
        if (conv && typeof p.first_name === 'string' && p.first_name.trim()) {
          conv.userName = p.first_name.trim();
        }
      }
    }

    const sorted = [...byOther.values()].sort(
      (a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime(),
    );

    setConversations(sorted);
    setLoading(false);
  }, [currentUserId]);

  useFocusEffect(
    useCallback(() => {
      if (currentUserId) void fetchConversations();
    }, [currentUserId, fetchConversations]),
  );

  function renderItem({ item }: { item: Conversation }) {
    const preview =
      item.lastMessage.trim().length > 0 ? item.lastMessage : EMPTY_CHAT_PREVIEW;

    return (
      <TouchableOpacity
        style={styles.convRow}
        onPress={() =>
          router.push({
            pathname: '/chat',
            params: {
              userId: item.userId,
              userName: item.userName,
              ...(item.matchId ? { matchId: item.matchId } : {}),
            },
          })
        }
        activeOpacity={0.8}>
        <View style={styles.avatar}>
          <ThemedText style={styles.avatarText}>
            {item.userName.charAt(0).toUpperCase()}
          </ThemedText>
        </View>
        <View style={styles.convInfo}>
          <ThemedText style={styles.convName}>{item.userName}</ThemedText>
          <ThemedText style={styles.convLast} numberOfLines={1}>
            {preview}
          </ThemedText>
        </View>
        <ThemedText style={styles.convTime}>{formatRelativeTime(item.lastAt)}</ThemedText>
      </TouchableOpacity>
    );
  }

  return (
    <ScreenContainer style={styles.container}>
      <ThemedText style={styles.title}>Messages</ThemedText>

      {loading ? (
        <View style={styles.emptyWrap}>
          <ThemedText style={styles.emptyText}>Loading…</ThemedText>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyWrap}>
          <ThemedText style={styles.emptyEmoji}>💬</ThemedText>
          <ThemedText style={styles.emptyText}>No messages yet</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Meet someone and start the conversation
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.userId}
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
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },

  list: { gap: 4, paddingBottom: 32 },

  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  convInfo: { flex: 1 },
  convName: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  convLast: { fontSize: 13, color: '#888', marginTop: 2 },
  convTime: { fontSize: 12, color: '#AAA' },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyEmoji: { fontSize: 48 },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
  emptySubtext: { fontSize: 14, color: '#888', textAlign: 'center' },
});
