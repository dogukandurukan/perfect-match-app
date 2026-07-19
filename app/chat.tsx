// Screen: Chat | Status: stable | Last updated: Temmuz 2026
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import { colors } from '@/lib/designTokens';
import { orderedPair } from '@/lib/matchInvite';
import { supabase } from '@/lib/supabaseClient';

function firstParam(val: string | string[] | undefined): string {
  if (Array.isArray(val)) return val[0] ?? '';
  return val ?? '';
}

type Message = {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const otherUserId = firstParam(params.userId);
  const userName = firstParam(params.userName) || 'them';
  const matchIdParam = firstParam(params.matchId);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(matchIdParam || null);
  const [chatOpened, setChatOpened] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList<Message>>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  const resolveMatchAndGate = useCallback(async () => {
    if (!currentUserId || !otherUserId) return;

    if (matchIdParam) {
      const { data } = await supabase
        .from('matches')
        .select('id, chat_opened')
        .eq('id', matchIdParam)
        .maybeSingle();
      if (data) {
        setMatchId(data.id);
        setChatOpened(data.chat_opened === true);
        return;
      }
    }

    const [a, b] = orderedPair(currentUserId, otherUserId);
    const { data } = await supabase
      .from('matches')
      .select('id, chat_opened')
      .eq('user_a_id', a)
      .eq('user_b_id', b)
      .maybeSingle();

    if (data) {
      setMatchId(data.id);
      setChatOpened(data.chat_opened === true);
    } else {
      setChatOpened(false);
    }
  }, [currentUserId, otherUserId, matchIdParam]);

  useFocusEffect(
    useCallback(() => {
      void resolveMatchAndGate();
    }, [resolveMatchAndGate]),
  );

  useEffect(() => {
    if (!currentUserId || !otherUserId || chatOpened !== true) return;

    void fetchMessages();

    const channel = supabase
      .channel(`chat-${currentUserId}-${otherUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new as Message;
          if (
            (msg.sender_id === currentUserId && msg.receiver_id === otherUserId) ||
            (msg.sender_id === otherUserId && msg.receiver_id === currentUserId)
          ) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
            setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, otherUserId, chatOpened]);

  async function fetchMessages() {
    if (!currentUserId || !otherUserId) return;
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at')
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),` +
          `and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`,
      )
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data as Message[]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }

  async function handleSend() {
    if (!text.trim() || !currentUserId || !otherUserId || chatOpened !== true) return;
    setSending(true);
    const content = text.trim();
    setText('');
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: otherUserId,
      content,
    });
    if (error) {
      setText(content);
    }
    setSending(false);
  }

  function renderMessage({ item }: { item: Message }) {
    const isMine = item.sender_id === currentUserId;
    return (
      <View style={[styles.msgWrap, isMine ? styles.msgWrapMine : styles.msgWrapTheirs]}>
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <ThemedText style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
            {item.content}
          </ThemedText>
        </View>
      </View>
    );
  }

  const inputLocked = chatOpened !== true;

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ThemedText style={styles.backText}>←</ThemedText>
        </TouchableOpacity>
        <ThemedText style={styles.headerName}>{userName}</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={90}>
        {inputLocked ? (
          <View style={styles.lockedWrap}>
            <ThemedText style={styles.lockedTitle}>Chat is locked</ThemedText>
            <ThemedText style={styles.lockedText}>
              Chat opens once {userName} accepts.
            </ThemedText>
            {matchId ? (
              <ThemedText style={styles.lockedHint}>You can go back to Matches to wait.</ThemedText>
            ) : null}
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <ThemedText style={styles.emptyText}>No messages yet. Say hi.</ThemedText>
              </View>
            }
          />
        )}

        <View style={[styles.inputRow, inputLocked && styles.inputRowLocked]}>
          <TextInput
            style={[styles.input, inputLocked && styles.inputDisabled]}
            placeholder={inputLocked ? 'Chat locked' : 'Message…'}
            placeholderTextColor="#AAA"
            value={text}
            onChangeText={setText}
            multiline
            editable={!inputLocked && !sending}
            returnKeyType="send"
            onSubmitEditing={() => void handleSend()}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (inputLocked || !text.trim() || sending) && { opacity: 0.4 },
            ]}
            onPress={() => void handleSend()}
            disabled={inputLocked || !text.trim() || sending}>
            <ThemedText style={styles.sendBtnText}>↑</ThemedText>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  backText: { fontSize: 24, color: colors.accent },
  headerName: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  messagesList: { padding: 16, gap: 8, flexGrow: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: { color: '#AAA', fontSize: 14, textAlign: 'center' },
  lockedWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 10,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  lockedText: { fontSize: 15, color: '#666', textAlign: 'center', lineHeight: 22 },
  lockedHint: { fontSize: 13, color: '#999', textAlign: 'center', marginTop: 8 },
  msgWrap: { flexDirection: 'row', marginBottom: 6 },
  msgWrapMine: { justifyContent: 'flex-end' },
  msgWrapTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: '#F0F0F0',
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 15, color: colors.textPrimary, lineHeight: 21 },
  bubbleTextMine: { color: '#FFF' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#FFF',
  },
  inputRowLocked: { opacity: 0.85 },
  input: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  inputDisabled: { backgroundColor: '#EEEEEE', color: '#999' },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnText: { color: '#FFF', fontSize: 20, fontWeight: '700' },
});
