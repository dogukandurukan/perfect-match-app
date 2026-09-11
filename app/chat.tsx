// Screen: Chat | Status: stable | Last updated: Temmuz 2026
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
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
import { logEvent } from '@/lib/analytics';
import { colors, radius } from '@/lib/designTokens';
import { formatMeetingTime, orderedPair, suggestMeetingTimes } from '@/lib/matchInvite';
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
  // "Suggest a meetup" nudge bar (mutual-like matches only — the algo-invite
  // flow already proposes a time/place as part of the invite itself, this
  // is for chats that opened straight into an empty conversation with no
  // structured next step, 2026-09-11).
  const [matchSource, setMatchSource] = useState<string | null>(null);
  const [meetingAt, setMeetingAt] = useState<string | null>(null);
  const [confirmedPlace, setConfirmedPlace] = useState<string | null>(null);
  // Pending/confirmed response cycle for the active proposal above — added
  // 2026-09-11 after finding the proposal was write-only (the other person
  // had no way to respond, and the proposer had no way to know it landed).
  const [meetupProposedBy, setMeetupProposedBy] = useState<string | null>(null);
  const [meetupConfirmed, setMeetupConfirmed] = useState<boolean | null>(null);
  const [respondingMeetup, setRespondingMeetup] = useState(false);
  const [proposeModalVisible, setProposeModalVisible] = useState(false);
  const [proposeTimes, setProposeTimes] = useState<string[]>([]);
  const [selectedProposeTime, setSelectedProposeTime] = useState<string | null>(null);
  const [proposePlace, setProposePlace] = useState('');
  const [showProposeTimePicker, setShowProposeTimePicker] = useState(false);
  const [proposeTimePickerDraft, setProposeTimePickerDraft] = useState(new Date());
  const [proposing, setProposing] = useState(false);
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
        .select(
          'id, chat_opened, user_a_id, user_b_id, source, meeting_at, confirmed_place, meetup_proposed_by, meetup_confirmed',
        )
        .eq('id', matchIdParam)
        .maybeSingle();
      if (error) {
        setGateError(true);
        return;
      }
      if (data) {
        setMatchId(data.id);
        setChatOpened(data.chat_opened === true);
        setMatchSource(data.source ?? null);
        setMeetingAt(data.meeting_at ?? null);
        setConfirmedPlace(data.confirmed_place ?? null);
        setMeetupProposedBy(data.meetup_proposed_by ?? null);
        setMeetupConfirmed(data.meetup_confirmed ?? null);
        return;
      }
    }

    const [a, b] = orderedPair(currentUserId, otherUserId);
    const { data, error } = await supabase
      .from('matches')
      .select(
        'id, chat_opened, source, meeting_at, confirmed_place, meetup_proposed_by, meetup_confirmed',
      )
      .eq('user_a_id', a)
      .eq('user_b_id', b)
      .maybeSingle();

    if (error) {
      setGateError(true);
    } else if (data) {
      setMatchId(data.id);
      setChatOpened(data.chat_opened === true);
      setMatchSource(data.source ?? null);
      setMeetingAt(data.meeting_at ?? null);
      setConfirmedPlace(data.confirmed_place ?? null);
      setMeetupProposedBy(data.meetup_proposed_by ?? null);
      setMeetupConfirmed(data.meetup_confirmed ?? null);
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
    const isFirstMessage = messages.length === 0;
    setText('');
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: otherUserId,
      content,
    });
    if (error) {
      setText(content);
      setSendError(true);
    } else if (isFirstMessage) {
      logEvent('first_message_sent', { match_source: matchSource });
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

  // Suggest-a-meetup modal — mutual-like chats only (see meetupUiEnabled
  // check below). Deliberately does NOT go through
  // sendMatchInvite/trySendInvite: this match is already accepted +
  // chat_opened, re-running the invite flow would reset status back to
  // 'pending' and re-apply the gendered chat-open rule, which would be
  // wrong here — both sides already gave equal consent. Writes meeting_at/
  // confirmed_place directly, no quota, no accept step (either side can
  // just propose a time in the open conversation, low-friction by design).
  async function openProposeModal() {
    setProposePlace('');
    setSelectedProposeTime(null);
    setShowProposeTimePicker(false);
    setProposeTimes([]);
    if (currentUserId) {
      const { data } = await supabase
        .from('profiles')
        .select('availability_days, availability_hours')
        .eq('id', currentUserId)
        .maybeSingle();
      setProposeTimes(suggestMeetingTimes(data?.availability_days, data?.availability_hours));
    }
    setProposeModalVisible(true);
  }

  function onProposeTimePickerChange(event: DateTimePickerEvent, selected?: Date) {
    if (Platform.OS === 'android') {
      setShowProposeTimePicker(false);
      if (event.type === 'set' && selected) setSelectedProposeTime(selected.toISOString());
      return;
    }
    if (selected) setProposeTimePickerDraft(selected);
  }

  async function confirmProposeMeetup() {
    if (!matchId || !selectedProposeTime || !currentUserId || !otherUserId) return;
    setProposing(true);
    const place = proposePlace.trim();
    const { error } = await supabase
      .from('matches')
      .update({
        meeting_at: selectedProposeTime,
        confirmed_place: place || null,
        meetup_proposed_by: currentUserId,
        meetup_confirmed: null,
      })
      .eq('id', matchId);
    if (error) {
      setProposing(false);
      Alert.alert('Could not suggest a time', error.message);
      return;
    }
    // Writing to `matches` alone is invisible to the other person — send an
    // actual chat message so they see the proposal (found 2026-09-11: this
    // was previously silent, "did it reach them?" had no answer — it didn't).
    const messageContent = `📅 I suggested meeting ${formatMeetingTime(selectedProposeTime)}${
      place ? ` at ${place}` : ''
    }. Let me know if that works!`;
    const { error: messageError } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: otherUserId,
      content: messageContent,
    });
    setProposing(false);
    if (messageError) {
      Alert.alert(
        'Time saved, but the message failed to send',
        messageError.message,
      );
    }
    setMeetingAt(selectedProposeTime);
    setConfirmedPlace(place || null);
    setMeetupProposedBy(currentUserId);
    setMeetupConfirmed(null);
    setProposeModalVisible(false);
  }

  // Resets the active proposal back to "no proposal" — used by both a plain
  // decline and a "suggest another time" (which then reopens the modal so
  // the responder becomes the new proposer).
  async function resetMeetupProposal(): Promise<string | null> {
    if (!matchId) return null;
    const { error } = await supabase
      .from('matches')
      .update({
        meeting_at: null,
        confirmed_place: null,
        meetup_proposed_by: null,
        meetup_confirmed: null,
      })
      .eq('id', matchId);
    return error?.message ?? null;
  }

  async function respondMeetupYes() {
    if (!matchId || !currentUserId || !otherUserId) return;
    setRespondingMeetup(true);
    const { error } = await supabase
      .from('matches')
      .update({ meetup_confirmed: true })
      .eq('id', matchId);
    if (error) {
      setRespondingMeetup(false);
      Alert.alert('Could not confirm', error.message);
      return;
    }
    const { error: messageError } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: otherUserId,
      content: '✅ Sounds good, see you then!',
    });
    setRespondingMeetup(false);
    if (messageError) console.warn('[Chat] confirm message failed', messageError.message);
    setMeetupConfirmed(true);
  }

  async function respondMeetupNo() {
    if (!currentUserId || !otherUserId) return;
    setRespondingMeetup(true);
    const resetError = await resetMeetupProposal();
    if (resetError) {
      setRespondingMeetup(false);
      Alert.alert('Could not respond', resetError);
      return;
    }
    const { error: messageError } = await supabase.from('messages').insert({
      sender_id: currentUserId,
      receiver_id: otherUserId,
      content: "❌ That time doesn't work for me.",
    });
    setRespondingMeetup(false);
    if (messageError) console.warn('[Chat] decline message failed', messageError.message);
    setMeetingAt(null);
    setConfirmedPlace(null);
    setMeetupProposedBy(null);
    setMeetupConfirmed(null);
  }

  async function respondMeetupSuggestAnother() {
    setRespondingMeetup(true);
    const resetError = await resetMeetupProposal();
    setRespondingMeetup(false);
    if (resetError) {
      Alert.alert('Could not respond', resetError);
      return;
    }
    setMeetingAt(null);
    setConfirmedPlace(null);
    setMeetupProposedBy(null);
    setMeetupConfirmed(null);
    void openProposeModal();
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
  // Unlike the icebreaker bar, this doesn't hide once you've sent a
  // message — a chat with no plan yet should keep nudging regardless of how
  // long the conversation runs. Originally mutual-like-only; widened
  // 2026-09-12 to any open chat (source no longer checked) so an
  // algorithmic invite's inviter has somewhere to counter-propose after
  // declining the accepter's custom time on the Activity review card — same
  // meetup_proposed_by/meetup_confirmed columns drive both paths now.
  const meetupUiEnabled = !inputDisabled;
  // 'none' = no active proposal · 'proposed_by_me' = waiting on the other
  // person · 'proposed_by_them' = I need to respond · 'confirmed' = settled.
  const meetupState: 'none' | 'proposed_by_me' | 'proposed_by_them' | 'confirmed' = !meetingAt
    ? 'none'
    : meetupConfirmed === true
      ? 'confirmed'
      : meetupProposedBy === currentUserId
        ? 'proposed_by_me'
        : 'proposed_by_them';
  const headerInitial = (userName.trim()[0] ?? '?').toUpperCase();

  return (
    <>
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

        {meetupUiEnabled && meetupState === 'none' ? (
          <TouchableOpacity
            style={styles.meetupBar}
            activeOpacity={0.85}
            onPress={() => void openProposeModal()}
            accessibilityRole="button"
            accessibilityLabel="Suggest a time to meet up">
            <ThemedText style={styles.meetupBarIcon}>☕</ThemedText>
            <ThemedText style={styles.meetupBarText}>Suggest a time to meet up</ThemedText>
            <Ionicons name="chevron-forward" size={16} color={colors.accent} />
          </TouchableOpacity>
        ) : null}

        {meetupUiEnabled && meetupState === 'proposed_by_me' ? (
          <View style={styles.meetupBar}>
            <ThemedText style={styles.meetupBarIcon}>⏳</ThemedText>
            <ThemedText style={styles.meetupBarText}>
              Waiting for {userName} to respond to your suggested time —{' '}
              {meetingAt ? formatMeetingTime(meetingAt) : ''}
              {confirmedPlace ? ` at ${confirmedPlace}` : ''}.
            </ThemedText>
          </View>
        ) : null}

        {meetupUiEnabled && meetupState === 'confirmed' ? (
          <View style={styles.meetupBar}>
            <ThemedText style={styles.meetupBarIcon}>✅</ThemedText>
            <ThemedText style={styles.meetupBarText}>
              Meetup confirmed — {meetingAt ? formatMeetingTime(meetingAt) : ''}
              {confirmedPlace ? ` at ${confirmedPlace}` : ''}
            </ThemedText>
          </View>
        ) : null}

        {meetupUiEnabled && meetupState === 'proposed_by_them' ? (
          <View style={styles.meetupRespondCard}>
            <ThemedText style={styles.meetupBarText}>
              {userName} suggested meeting {meetingAt ? formatMeetingTime(meetingAt) : ''}
              {confirmedPlace ? ` at ${confirmedPlace}` : ''}.
            </ThemedText>
            <View style={styles.meetupRespondRow}>
              <TouchableOpacity
                style={[styles.meetupRespondBtn, styles.meetupRespondYes]}
                activeOpacity={0.85}
                disabled={respondingMeetup}
                onPress={() => void respondMeetupYes()}
                accessibilityRole="button"
                accessibilityLabel="Yes, that works">
                <ThemedText style={styles.meetupRespondYesText}>Yes</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.meetupRespondBtn}
                activeOpacity={0.85}
                disabled={respondingMeetup}
                onPress={() => void respondMeetupSuggestAnother()}
                accessibilityRole="button"
                accessibilityLabel="Suggest another time">
                <ThemedText style={styles.meetupRespondBtnText}>Another time</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.meetupRespondBtn}
                activeOpacity={0.85}
                disabled={respondingMeetup}
                onPress={() => void respondMeetupNo()}
                accessibilityRole="button"
                accessibilityLabel="No, that doesn't work">
                <ThemedText style={styles.meetupRespondBtnText}>No</ThemedText>
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

    <Modal
      visible={proposeModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setProposeModalVisible(false)}>
      <KeyboardAvoidingView
        style={styles.proposeBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.proposeSheet}>
          <ThemedText style={styles.proposeTitle}>Suggest a time to meet up</ThemedText>

          {proposeTimes.length > 0 ? (
            <View style={styles.slotChipsRow}>
              {proposeTimes.map((t) => {
                const on = selectedProposeTime === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[styles.slotChip, on && styles.slotChipSelected]}
                    onPress={() => {
                      setSelectedProposeTime(t);
                      setShowProposeTimePicker(false);
                    }}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityLabel={formatMeetingTime(t)}
                    accessibilityState={{ selected: on }}>
                    <ThemedText style={[styles.slotChipText, on && styles.slotChipTextSelected]}>
                      {formatMeetingTime(t)}
                    </ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : null}

          {selectedProposeTime && !proposeTimes.includes(selectedProposeTime) ? (
            <View style={styles.slotChipsRow}>
              <TouchableOpacity
                style={[styles.slotChip, styles.slotChipSelected]}
                onPress={() => setShowProposeTimePicker(true)}
                activeOpacity={0.8}>
                <ThemedText style={[styles.slotChipText, styles.slotChipTextSelected]}>
                  {formatMeetingTime(selectedProposeTime)}
                </ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => {
                setProposeTimePickerDraft(new Date());
                setShowProposeTimePicker(true);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Pick another time">
              <ThemedText style={styles.proposeCustomLink}>Pick another time</ThemedText>
            </TouchableOpacity>
          )}

          {showProposeTimePicker ? (
            <View style={styles.proposeTimePickerColumn}>
              <DateTimePicker
                value={proposeTimePickerDraft}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={onProposeTimePickerChange}
                themeVariant="light"
                textColor="#1A1A1A"
              />
              {Platform.OS === 'ios' ? (
                <TouchableOpacity
                  style={styles.proposeAddSlotBtn}
                  onPress={() => {
                    setSelectedProposeTime(proposeTimePickerDraft.toISOString());
                    setShowProposeTimePicker(false);
                  }}
                  activeOpacity={0.85}>
                  <ThemedText style={styles.proposeAddSlotBtnText}>Use this time</ThemedText>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <ThemedText style={styles.proposePlaceLabel}>Where? (optional)</ThemedText>
          <TextInput
            style={styles.proposePlaceInput}
            placeholder="e.g. a coffee place near you"
            placeholderTextColor={colors.textMuted}
            value={proposePlace}
            onChangeText={setProposePlace}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />

          <View style={styles.proposeBtnRow}>
            <TouchableOpacity
              style={styles.proposeCancelBtn}
              activeOpacity={0.8}
              onPress={() => setProposeModalVisible(false)}>
              <ThemedText style={styles.proposeCancelBtnText}>Cancel</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.proposeConfirmBtn, !selectedProposeTime && { opacity: 0.4 }]}
              activeOpacity={0.85}
              disabled={!selectedProposeTime || proposing}
              onPress={() => void confirmProposeMeetup()}>
              {proposing ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <ThemedText style={styles.proposeConfirmBtnText}>Suggest</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
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
  meetupBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  meetupBarIcon: { fontSize: 16 },
  meetupBarText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  meetupRespondCard: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  meetupRespondRow: { flexDirection: 'row', gap: 8 },
  meetupRespondBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  meetupRespondBtnText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  meetupRespondYes: { backgroundColor: colors.accent, borderColor: colors.accent },
  meetupRespondYesText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  proposeBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  proposeSheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 14,
  },
  proposeTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  slotChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  slotChipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  slotChipText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  slotChipTextSelected: { color: '#FFF' },
  proposeCustomLink: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
    textDecorationLine: 'underline',
  },
  proposeTimePickerColumn: { alignItems: 'stretch', gap: 8 },
  proposeAddSlotBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.accent,
  },
  proposeAddSlotBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  proposePlaceLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  proposePlaceInput: {
    backgroundColor: colors.bgSubtle,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  proposeBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  proposeCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.bgSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  proposeCancelBtnText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  proposeConfirmBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: colors.accent,
  },
  proposeConfirmBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
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
