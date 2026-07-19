// Screen: Mesajlar tab | Status: test | Last updated: Mayıs 2026
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { supabase } from '@/lib/supabaseClient';

type Conversation = {
  userId: string;
  userName: string;
  lastMessage: string;
  lastTime: string;
};

export default function MessagesScreen() {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (currentUserId) fetchConversations();
    }, [currentUserId]),
  );

  async function fetchConversations() {
    if (!currentUserId) return;
    setLoading(true);

    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${currentUserId},receiver_id.eq.${currentUserId}`)
      .order('created_at', { ascending: false });

    if (!msgs) {
      setLoading(false);
      return;
    }

    // Her kullanıcıyla son mesajı bul
    const seen = new Set<string>();
    const convMap: Conversation[] = [];

    for (const msg of msgs) {
      const otherId =
        msg.sender_id === currentUserId ? msg.receiver_id : msg.sender_id;
      if (seen.has(otherId)) continue;
      seen.add(otherId);

      // Karşı tarafın adını çek
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name')
        .eq('id', otherId)
        .single();

      convMap.push({
        userId: otherId,
        userName: profile?.first_name ?? 'Kullanıcı',
        lastMessage: msg.content,
        lastTime: new Date(msg.created_at).toLocaleTimeString('tr-TR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
    }

    setConversations(convMap);
    setLoading(false);
  }

  function renderItem({ item }: { item: Conversation }) {
    return (
      <TouchableOpacity
        style={styles.convRow}
        onPress={() =>
          router.push({
            pathname: '/chat',
            params: { userId: item.userId, userName: item.userName },
          } as any)
        }
        activeOpacity={0.8}
      >
        <View style={styles.avatar}>
          <ThemedText style={styles.avatarText}>
            {item.userName.charAt(0).toUpperCase()}
          </ThemedText>
        </View>
        <View style={styles.convInfo}>
          <ThemedText style={styles.convName}>{item.userName}</ThemedText>
          <ThemedText style={styles.convLast} numberOfLines={1}>
            {item.lastMessage}
          </ThemedText>
        </View>
        <ThemedText style={styles.convTime}>{item.lastTime}</ThemedText>
      </TouchableOpacity>
    );
  }

  return (
    <ScreenContainer style={styles.container}>
      <ThemedText style={styles.title}>💬 Mesajlar</ThemedText>

      {loading ? (
        <View style={styles.emptyWrap}>
          <ThemedText style={styles.emptyText}>Yükleniyor...</ThemedText>
        </View>
      ) : conversations.length === 0 ? (
        <View style={styles.emptyWrap}>
          <ThemedText style={styles.emptyEmoji}>💬</ThemedText>
          <ThemedText style={styles.emptyText}>Henüz mesajın yok.</ThemedText>
          <ThemedText style={styles.emptySubtext}>
            Eşleşmelerinden birine mesaj gönder!
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
