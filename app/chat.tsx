// Screen: Chat | Status: stable | Last updated: Temmuz 2026
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { ErrorState } from '@/components/ErrorState';
import { ThemedText } from '@/components/themed-text';
import { ScreenContainer } from '@/components/ui/ScreenContainer';
import {
  buildQuickIcebreakerLine,
  pickRandomQuestions,
  type QuickIcebreakerAnswer,
  type QuickIcebreakerChoice,
} from '@/lib/quickIcebreaker';
import { colors, radius } from '@/lib/designTokens';
import { orderedPair } from '@/lib/matchInvite';
import { getProfilePhotoPublicUrl } from '@/lib/resolveProfilePhotoUrl';
import { supabase } from '@/lib/supabaseClient';
import { emitUnreadMessageCount } from '@/lib/unreadMessageCount';

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
  const [gateError, setGateError] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesError, setMessagesError] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  // Random 5-of-10 subset for THIS user's first-ever answer — fixed once per
  // component mount so it doesn't reshuffle mid-quiz.
  const [iceQuestions] = useState(() => pickRandomQuestions());
  const [iceStep, setIceStep] = useState(0);
  const [iceAnswers, setIceAnswers] = useState<QuickIcebreakerAnswer[]>([]);
  const [iceDone, setIceDone] = useState(false);
  // Persisted answers from a previous chat (profiles.quick_icebreaker_answers)
  // — null while unchecked/never answered. Once set, new empty chats show a
  // single "use my opener" chip instead of the 5-question walk.
  const [savedIcebreaker, setSavedIcebreaker] = useState<QuickIcebreakerAnswer[] | null>(null);
  const [icebreakerChecked, setIcebreakerChecked] = useState(false);
  const [headerPhotoUrl, setHeaderPhotoUrl] = useState<string | null>(null);
  const [myPhotoUrl, setMyPhotoUrl] = useState<string | null>(null);
  const [myInitial, setMyInitial] = useState('?');
  const [keyboardShown, setKeyboardShown] = useState(false);
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<Message>>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null);
    });
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvt, () => setKeyboardShown(true));
    const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardShown(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
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
        .select('id, chat_opened, user_a_id, user_b_id')
        .eq('id', matchIdParam)
        .maybeSingle();
      if (error) {
        setGateError(true);
        return;
      }
      if (data) {
        setMatchId(data.id);
        setChatOpened(data.chat_opened === true);
        return;
      }
    }

    const [a, b] = orderedPair(currentUserId, otherUserId);
    const { data, error } = await supabase
      .from('matches')
      .select('id, chat_opened')
      .eq('user_a_id', a)
      .eq('user_b_id', b)
      .maybeSingle();

    if (error) {
      setGateError(true);
    } else if (data) {
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
            if (msg.sender_id === otherUserId) void markIncomingMessagesRead();
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentUserId, otherUserId, chatOpened]);

  // Per-chat quiz progress resets on a new conversation; the underlying
  // answers (savedIcebreaker) are per-USER and fetched separately below, not
  // reset here.
  useEffect(() => {
    setIceStep(0);
    setIceAnswers([]);
    setIceDone(false);
  }, [otherUserId]);

  // Answered before (any chat, ever)? Fetch once per user so repeat matches
  // skip straight to a single "use my opener" chip instead of re-asking the
  // same 5 questions (user feedback, 2026-09-10).
  useEffect(() => {
    if (!currentUserId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('quick_icebreaker_answers')
        .eq('id', currentUserId)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.warn('[Chat] quick_icebreaker_answers fetch failed', error.message);
      const saved = Array.isArray(data?.quick_icebreaker_answers)
        ? (data.quick_icebreaker_answers as QuickIcebreakerAnswer[])
        : null;
      setSavedIcebreaker(saved && saved.length > 0 ? saved : null);
      setIcebreakerChecked(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  // Marks the other person's messages to me as read (real read tracking —
  // the Chats tab badge used to just guess from "who sent the last message",
  // which stayed "unread" forever if you read without replying).
  async function markIncomingMessagesRead() {
    if (!currentUserId || !otherUserId) return;
    const { error } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('sender_id', otherUserId)
      .eq('receiver_id', currentUserId)
      .is('read_at', null);
    if (error) {
      console.warn('[Chat] markIncomingMessagesRead failed', error);
      return;
    }
    void emitUnreadMessageCount();
  }

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
      void markIncomingMessagesRead();
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

  function handleAddPhoto() {
    if (inputDisabled) return;
    Alert.alert('Add a photo', undefined, [
      { text: 'Take Photo', onPress: () => void openPhotoPicker('camera') },
      { text: 'Choose from Library', onPress: () => void openPhotoPicker('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function openPhotoPicker(source: 'camera' | 'library') {
    try {
      const result =
        source === 'camera'
          ? await (async () => {
              const perm = await ImagePicker.requestCameraPermissionsAsync();
              if (!perm.granted) {
                Alert.alert('Camera access needed', 'Enable camera access in Settings to take a photo.');
                return null;
              }
              return ImagePicker.launchCameraAsync({ quality: 0.7 });
            })()
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (result && !result.canceled) {
        // TODO(P2 Katman 2): media_url kolonu + storage bucket + upload gelince gerçek gönderim.
        Alert.alert('Coming soon', 'Photo sharing is on the way.');
      }
    } catch (e) {
      console.warn('[Chat] photo picker failed', e);
    }
  }

  function handleQuickPick(choice: QuickIcebreakerChoice) {
    const question = iceQuestions[iceStep];
    if (!question) return;
    const nextAnswers = [...iceAnswers, { id: question.id, choice }];
    if (nextAnswers.length >= iceQuestions.length) {
      setIceAnswers(nextAnswers);
      setIceDone(true);
      setSavedIcebreaker(nextAnswers);
      setText(buildQuickIcebreakerLine(nextAnswers));
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
      if (currentUserId) {
        void supabase
          .from('profiles')
          .update({ quick_icebreaker_answers: nextAnswers })
          .eq('id', currentUserId)
          .then(({ error }) => {
            if (error) console.warn('[Chat] quick_icebreaker_answers save failed', error.message);
          });
      }
      return;
    }
    setIceAnswers(nextAnswers);
    setIceStep((i) => i + 1);
  }

  function handleUseSavedIcebreaker() {
    if (!savedIcebreaker) return;
    setIceDone(true);
    setText(buildQuickIcebreakerLine(savedIcebreaker));
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
    !inputDisabled && messages.length === 0 && !iceDone && icebreakerChecked;
  const currentIceQuestion = iceQuestions[iceStep];
  const headerInitial = (userName.trim()[0] ?? '?').toUpperCase();

  return (
    <ScreenContainer style={[styles.container, { paddingBottom: 0 }]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back">
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
        keyboardVerticalOffset={0}>
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

        {showIcebreakers && savedIcebreaker ? (
          <View style={styles.iceWrap}>
            <ThemedText style={styles.iceTitle}>Your icebreaker ✨</ThemedText>
            <TouchableOpacity
              style={styles.iceSavedChip}
              onPress={handleUseSavedIcebreaker}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Use my icebreaker opener">
              <ThemedText style={styles.iceChipText} numberOfLines={2}>
                {buildQuickIcebreakerLine(savedIcebreaker)}
              </ThemedText>
            </TouchableOpacity>
          </View>
        ) : showIcebreakers && currentIceQuestion ? (
          <View style={styles.iceWrap}>
            <ThemedText style={styles.iceTitle}>
              Quick this-or-that ✨ ({iceStep + 1}/{iceQuestions.length})
            </ThemedText>
            <View style={styles.iceQuizRow}>
              <TouchableOpacity
                style={styles.iceQuizOption}
                onPress={() => handleQuickPick('A')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={currentIceQuestion.optionA.label}>
                <ThemedText style={styles.iceQuizEmoji}>
                  {currentIceQuestion.optionA.emoji}
                </ThemedText>
                <ThemedText style={styles.iceQuizLabel}>
                  {currentIceQuestion.optionA.label}
                </ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.iceQuizOr}>or</ThemedText>
              <TouchableOpacity
                style={styles.iceQuizOption}
                onPress={() => handleQuickPick('B')}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={currentIceQuestion.optionB.label}>
                <ThemedText style={styles.iceQuizEmoji}>
                  {currentIceQuestion.optionB.emoji}
                </ThemedText>
                <ThemedText style={styles.iceQuizLabel}>
                  {currentIceQuestion.optionB.label}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {sendError ? (
          <ThemedText style={styles.sendErrorText}>
            Message didn’t send. Tap ↑ to try again.
          </ThemedText>
        ) : null}
        <View
          style={[
            styles.inputRow,
            inputLocked && styles.inputRowLocked,
            { paddingBottom: keyboardShown ? 12 : insets.bottom + 12 },
          ]}>
          <TouchableOpacity
            style={[styles.attachBtn, inputDisabled && { opacity: 0.4 }]}
            onPress={handleAddPhoto}
            disabled={inputDisabled}
            accessibilityRole="button"
            accessibilityLabel="Add a photo">
            <Ionicons name="camera-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={[styles.input, inputDisabled && styles.inputDisabled]}
            placeholder={inputLocked ? 'Chat locked' : `Message ${userName}…`}
            placeholderTextColor={colors.textMuted}
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
            disabled={inputDisabled || !text.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityState={{ disabled: inputDisabled || !text.trim() || sending }}>
            {sending ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Ionicons name="arrow-up" size={22} color="#FFF" />
            )}
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
  iceSavedChip: {
    marginHorizontal: 12,
    backgroundColor: '#FFF8E8',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iceChipText: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textPrimary,
  },
  iceQuizRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 10,
  },
  iceQuizOption: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF8E8',
    borderWidth: 1,
    borderColor: '#1A1A1A',
    borderRadius: 14,
    paddingVertical: 12,
  },
  iceQuizEmoji: { fontSize: 24 },
  iceQuizLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  iceQuizOr: { fontSize: 12, color: colors.textMuted },
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
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  inputRowLocked: { opacity: 0.85 },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.bgSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    maxHeight: 100,
  },
  inputDisabled: { backgroundColor: colors.bgSubtle, color: colors.textMuted },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
