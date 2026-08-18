// Screen: Messages tab | Status: test | Last updated: Mayıs 2026
import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { ErrorState } from '@/components/ErrorState';
import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { formatRelativeTime } from '@/lib/labels';
import { getProfilePhotoPublicUrl } from '@/lib/resolveProfilePhotoUrl';
import { supabase } from '@/lib/supabaseClient';

const EMPTY_CHAT_PREVIEW = 'You matched — say hi 👋';
const VISIBLE_COUNT = 3;

type Conversation = {
  userId: string;
  userName: string;
  lastMessage: string;
  lastAt: string;
  matchId: string | null;
  photoUrl: string | null;
};

export default function MessagesScreen() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    setError(false);

    const [{ data: msgs, error: msgsError }, { data: openMatches, error: matchesError }] =
      await Promise.all([
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

    if (msgsError || matchesError) {
      setError(true);
      setLoading(false);
      return;
    }

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
        photoUrl: null,
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
        photoUrl: null,
      });
    }

    const otherIds = [...byOther.keys()];
    if (otherIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, photos')
        .in('id', otherIds);

      for (const p of profiles ?? []) {
        if (typeof p.id !== 'string') continue;
        const conv = byOther.get(p.id);
        if (!conv) continue;
        if (typeof p.first_name === 'string' && p.first_name.trim()) {
          conv.userName = p.first_name.trim();
        }
        const first = Array.isArray(p.photos) ? p.photos[0] : null;
        if (typeof first === 'string' && first.trim()) {
          conv.photoUrl = getProfilePhotoPublicUrl(first);
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
        {item.photoUrl ? (
          <Image source={{ uri: item.photoUrl }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>
              {item.userName.charAt(0).toUpperCase()}
            </ThemedText>
          </View>
        )}
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
      <ThemedText style={styles.title}>Chats</ThemedText>

      {loading ? (
        <View style={styles.emptyWrap}>
          <ThemedText style={styles.emptyText}>Loading…</ThemedText>
        </View>
      ) : error ? (
        <ErrorState onRetry={() => void fetchConversations()} />
      ) : conversations.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="chatbubbles-outline" size={28} color={colors.accent} />
          </View>
          <ThemedText style={styles.emptyText}>Your chats will show up here</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Once someone accepts your invite, the conversation opens right here.
          </ThemedText>
          <TouchableOpacity
            style={styles.emptyCta}
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/matches' as never)}
            accessibilityRole="button"
            accessibilityLabel="Find people to meet">
            <ThemedText style={styles.emptyCtaText}>Find people to meet</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={expanded ? conversations : conversations.slice(0, VISIBLE_COUNT)}
          keyExtractor={(item) => item.userId}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListFooterComponent={
            conversations.length > VISIBLE_COUNT ? (
              <TouchableOpacity
                style={styles.toggleRow}
                onPress={() => setExpanded((v) => !v)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={
                  expanded ? 'Show fewer conversations' : 'Show older conversations'
                }>
                <ThemedText style={styles.toggleText}>
                  {expanded
                    ? 'Show less'
                    : `Show ${conversations.length - VISIBLE_COUNT} older`}
                </ThemedText>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={colors.accent}
                />
              </TouchableOpacity>
            ) : null
          }
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

  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  toggleText: { fontSize: 14, fontWeight: '600', color: colors.accent },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 36,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FBF3DF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyText: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, textAlign: 'center' },
  emptySubtext: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  emptyCta: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: colors.accent,
  },
  emptyCtaText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
