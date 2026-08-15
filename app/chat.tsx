// Screen: Chat | Status: stable | Last updated: Temmuz 2026
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { ErrorState } from '@/components/ErrorState';
import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import {
  generateIcebreakers,
  type IcebreakerProfile,
} from '@/lib/icebreakers';
import { colors } from '@/lib/designTokens';
import { orderedPair } from '@/lib/matchInvite';
import { getProfilePhotoPublicUrl } from '@/lib/resolveProfilePhotoUrl';
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

const PROFILE_FIELDS =
  'hobbies, favorite_book, favorite_movie, favorite_music, district, languages' as const;

function toIcebreakerProfile(row: {
  hobbies?: string[] | null;
  favorite_book?: string | null;
  favorite_movie?: string | null;
  favorite_music?: string | null;
  district?: string | null;
  languages?: string[] | null;
} | null): IcebreakerProfile {
  return {
    hobbies: row?.hobbies ?? null,
    favorite_book: row?.favorite_book ?? null,
    favorite_movie: row?.favorite_movie ?? null,
    favorite_music: row?.favorite_music ?? null,
    district: row?.district ?? null,
    languages: row?.languages ?? null,
  };
}

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const otherUserId = firstParam(params.userId);
  const userName = firstParam(params.userName) || 'them';
  const matchIdParam = firstParam(params.matchId);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [matchId, setMatchId] = useState<string | null>(matchIdParam || null);
  const [chatOpened, setChatOpened] = useState<boolean | null>(null);
  const [gateError, setGateError] = useState(false);
  const [matchPercentage, setMatchPercentage] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesError, setMessagesError] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [icebreakers, setIcebreakers] = useState<string[]>([]);
  const [headerPhotoUrl, setHeaderPhotoUrl] = useState<string | null>(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState<string | null>(null);
  const [myInitial, setMyInitial] = useState('?');
  const flatListRef = useRef<FlatList<Message>>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (!otherUserId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('photos')
        .eq('id', otherUserId)
        .maybeSingle();
      if (cancelled) return;
      const first = data?.photos?.[0];
      setHeaderPhotoUrl(first?.trim() ? getProfilePhotoPublicUrl(first) : null);
    })();
    return () => {
      cancelled = true;
    };
  }, [otherUserId]);

  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('photos, first_name')
        .eq('id', currentUserId)
        .maybeSingle();
      if (cancelled) return;
      const first = data?.photos?.[0];
      setMyPhotoUrl(first?.trim() ? getProfilePhotoPublicUrl(first) : null);
      setMyInitial((data?.first_name?.trim()[0] ?? '?').toUpperCase());
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const resolveMatchAndGate = useCallback(async () => {
    if (!currentUserId || !otherUserId) return;

    setGateError(false);

    if (matchIdParam) {
      const { data, error } = await supabase
        .from('matches')
        .select('id, chat_opened, match_score, user_a_id, user_b_id')
        .eq('id', matchIdParam)
        .maybeSingle();
      if (error) {
        setGateError(true);
        return;
      }
      if (data) {
        setMatchId(data.id);
        setChatOpened(data.chat_opened === true);
        setMatchPercentage(Number(data.match_score) || 0);
        return;
      }
    }

    const [a, b] = orderedPair(currentUserId, otherUserId);
    const { data, error } = await supabase
      .from('matches')
      .select('id, chat_opened, match_score')
      .eq('user_a_id', a)
      .eq('user_b_id', b)
      .maybeSingle();

    if (error) {
      setGateError(true);
    } else if (data) {
      setMatchId(data.id);
      setChatOpened(data.chat_opened === true);
      setMatchPercentage(Number(data.match_score) || 0);
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

  useEffect(() => {
    if (!currentUserId || !otherUserId || chatOpened !== true) {
      setIcebreakers([]);
      return;
    }
    if (messages.length > 0) {
      setIcebreakers([]);
      return;
    }

    let cancelled = false;
    void (async () => {
      const [{ data: meRow }, { data: themRow }] = await Promise.all([
        supabase.from('profiles').select(PROFILE_FIELDS).eq('id', currentUserId).maybeSingle(),
        supabase.from('profiles').select(PROFILE_FIELDS).eq('id', otherUserId).maybeSingle(),
      ]);
      if (cancelled) return;
      const tips = await generateIcebreakers(
        toIcebreakerProfile(meRow),
        toIcebreakerProfile(themRow),
        matchPercentage,
      );
      if (!cancelled) setIcebreakers(tips);
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUserId, otherUserId, chatOpened, messages.length, matchPercentage]);

  async function fetchMessages() {
    if (!currentUserId || !otherUserId) return;
    const { data, error } = await supabase
      .from('messages')
      .select('id, sender_id, receiver_id, content, created_at')
      .or(
        `and(sender_id.eq.${currentUserId},receiver_id.eq.${otherUserId}),` +
          `and(sender_id.eq.${otherUserId},receiver_id.eq.${currentUserId})`,
      )
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[Chat] fetchMessages failed', error);
      setMessagesError(true);
      return;
    }

    setMessagesError(false);
    if (data) {
      setMessages(data as Message[]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
    }
  }

  async function handleSend() {
    if (!text.trim() || !currentUserId || !otherUserId || chatOpened !== true) return;
    setSending(true);
    setSendError(false);
    const content = text.trim();
    setText('');
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: otherUserId,
      content,
    });
    if (error) {
      setText(content);
      setSendError(true);
    }
    setSending(false);
  }

  function applyIcebreaker(tip: string) {
    setText(tip);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }

  function openUserProfile() {
    if (!otherUserId) return;
    const activeMatchId = matchId ?? matchIdParam;
    router.push({
      pathname: '/user-profile',
      params: {
        userId: otherUserId,
        ...(activeMatchId ? { matchId: activeMatchId } : {}),
      },
    });
  }

  function renderMessage({ item, index }: { item: Message; index: number }) {
    const isMine = item.sender_id === currentUserId;
    const isLastOfGroup =
      index === messages.length - 1 ||
      messages[index + 1]?.sender_id !== item.sender_id;
    return (
      <View style={[styles.msgWrap, isMine ? styles.msgWrapMine : styles.msgWrapTheirs]}>
        {!isMine ? (
          isLastOfGroup ? (
            <TouchableOpacity onPress={openUserProfile} activeOpacity={0.7}>
              {headerPhotoUrl ? (
                <Image source={{ uri: headerPhotoUrl }} style={styles.msgAvatar} contentFit="cover" />
              ) : (
                <View style={styles.msgAvatarPlaceholder}>
                  <ThemedText style={styles.msgAvatarInitial}>{headerInitial}</ThemedText>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <View style={styles.msgAvatar} />
          )
        ) : null}
        <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <ThemedText style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>
            {item.content}
          </ThemedText>
        </View>
        {isMine ? (
          isLastOfGroup ? (
            myPhotoUrl ? (
              <Image source={{ uri: myPhotoUrl }} style={styles.msgAvatarMine} contentFit="cover" />
            ) : (
              <View style={styles.msgAvatarPlaceholderMine}>
                <ThemedText style={styles.msgAvatarInitial}>{myInitial}</ThemedText>
              </View>
            )
          ) : (
            <View style={styles.msgAvatarMine} />
          )
        ) : null}
      </View>
    );
  }

  const chatLoading = chatOpened === null;
  const inputLocked = chatOpened === false;
  const inputDisabled = chatLoading || inputLocked;
  const showIcebreakers =
    !inputDisabled && messages.length === 0 && icebreakers.length > 0;
  const headerInitial = (userName.trim()[0] ?? '?').toUpperCase();

  return (
    <ScreenContainer style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ThemedText style={styles.backText}>←</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={openUserProfile}
          style={styles.headerCenter}
          activeOpacity={0.7}>
          {headerPhotoUrl ? (
            <Image source={{ uri: headerPhotoUrl }} style={styles.headerAvatar} contentFit="cover" />
          ) : (
            <View style={styles.headerAvatarPlaceholder}>
              <ThemedText style={styles.headerAvatarInitial}>{headerInitial}</ThemedText>
            </View>
          )}
          <ThemedText style={styles.headerName}>{userName}</ThemedText>
        </TouchableOpacity>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={90}>
        {gateError ? (
          <ErrorState onRetry={() => void resolveMatchAndGate()} />
        ) : chatLoading ? (
          <View style={styles.lockedWrap}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : inputLocked ? (
          <View style={styles.lockedWrap}>
            <ThemedText style={styles.lockedTitle}>Chat is locked</ThemedText>
            <ThemedText style={styles.lockedText}>
              Chat opens once {userName} accepts.
            </ThemedText>
            {matchId ? (
              <ThemedText style={styles.lockedHint}>You can go back to Matches to wait.</ThemedText>
            ) : null}
          </View>
        ) : messagesError && messages.length === 0 ? (
          <ErrorState onRetry={() => void fetchMessages()} />
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
                <ThemedText style={styles.emptyText}>You matched — say hi 👋</ThemedText>
              </View>
            }
          />
        )}

        {showIcebreakers ? (
          <View style={styles.iceWrap}>
            <ThemedText style={styles.iceTitle}>Break the ice ✨</ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.iceScroll}>
              {icebreakers.map((tip) => (
                <TouchableOpacity
                  key={tip}
                  style={styles.iceChip}
                  onPress={() => applyIcebreaker(tip)}
                  activeOpacity={0.85}>
                  <ThemedText style={styles.iceChipText}>{tip}</ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {sendError ? (
          <ThemedText style={styles.sendErrorText}>
            Message didn’t send. Tap ↑ to try again.
          </ThemedText>
        ) : null}
        <View style={[styles.inputRow, inputLocked && styles.inputRowLocked]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, inputDisabled && styles.inputDisabled]}
            placeholder={inputLocked ? 'Chat locked' : `Message ${userName}…`}
            placeholderTextColor="#AAA"
            value={text}
            onChangeText={(v) => {
              setText(v);
              if (sendError) setSendError(false);
            }}
            multiline
            editable={!inputDisabled && !sending}
            returnKeyType="send"
            onSubmitEditing={() => void handleSend()}
          />
          <TouchableOpacity
            style={[
              styles.sendBtn,
              (inputDisabled || !text.trim() || sending) && { opacity: 0.4 },
            ]}
            onPress={() => void handleSend()}
            disabled={inputDisabled || !text.trim() || sending}>
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
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerAvatar: { width: 32, height: 32, borderRadius: 16 },
  headerAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitial: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
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
  sendErrorText: {
    fontSize: 13,
    color: '#C0392B',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  lockedHint: { fontSize: 13, color: '#999', textAlign: 'center', marginTop: 8 },
  iceWrap: {
    paddingTop: 4,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EFEFEF',
  },
  iceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  iceScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  iceChip: {
    maxWidth: 280,
    backgroundColor: '#FFF8E8',
    borderWidth: 1,
    borderColor: '#B8860B',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iceChipText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  msgWrap: { flexDirection: 'row', marginBottom: 6, alignItems: 'flex-end' },
  msgWrapMine: { justifyContent: 'flex-end' },
  msgWrapTheirs: { justifyContent: 'flex-start' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8 },
  msgAvatarMine: { width: 28, height: 28, borderRadius: 14, marginLeft: 8 },
  msgAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgAvatarPlaceholderMine: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: 8,
    backgroundColor: '#E8E8E8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgAvatarInitial: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
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
