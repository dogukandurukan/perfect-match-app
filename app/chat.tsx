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
import { radius } from '@/lib/designTokens';
import { formatMeetingTime, orderedPair, suggestMeetingTimes } from '@/lib/matchInvite';
import { resolveProfilePhotoUrl } from '@/lib/resolveProfilePhotoUrl';
import { supabase, v2Enabled } from '@/lib/supabaseClient';
import { isSendableTime } from '@/lib/onboardingV2/dateSuggestions';
import { obColors, obFonts } from '@/lib/onboardingV2/theme';
import { SuggestDateSheet } from '@/components/chat/SuggestDateSheet';
import {
  loadChatState,
  newRequestId,
  proposeDate,
  respondDate,
  unmatch,
  type ChatState,
  type Proposal,
} from '@/lib/matchChatV2';
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
  // V2 (dev/test backends): server chat state + date suggestions shown as
  // in-chat cards. The suggestion is opened by the user from the + menu —
  // no persistent bar, no pop-up.
  const [chatState, setChatState] = useState<ChatState | null>(null);
  const [counterTarget, setCounterTarget] = useState<Proposal | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);
  const proposeRequestRef = useRef<string | null>(null);
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
    // getSession() (local, no network) instead of getUser() — this fires
    // every time a chat is opened, a very frequent action (2026-09-15 fix).
    void supabase.auth.getSession().then(({ data }) => {
      setCurrentUserId(data.session?.user?.id ?? null);
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
        .from('profile_cards')
        .select('photos')
        .eq('id', otherUserId)
        .maybeSingle();
      if (cancelled) return;
      const url = await resolveProfilePhotoUrl(data?.photos?.[0]);
      if (cancelled) return;
      setHeaderPhotoUrl(url);
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
      const myUrl = await resolveProfilePhotoUrl(data?.photos?.[0]);
      if (cancelled) return;
      setMyPhotoUrl(myUrl);
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

  const refreshChatState = useCallback(async () => {
    if (!v2Enabled || !matchId) return;
    const r = await loadChatState(matchId);
    if (r.ok) setChatState(r.value);
  }, [matchId]);

  // On focus, and every 20 s while the chat is open (suggestions are not on
  // the realtime feed) — a light poll, no pop-up.
  useFocusEffect(
    useCallback(() => {
      if (!v2Enabled || !matchId) return;
      void refreshChatState();
      const t = setInterval(() => void refreshChatState(), 20000);
      return () => clearInterval(t);
    }, [matchId, refreshChatState]),
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
  async function openProposeModal(counter: Proposal | null = null) {
    setCounterTarget(counter);
    proposeRequestRef.current = newRequestId();
    setProposePlace('');
    setSelectedProposeTime(null);
    setShowProposeTimePicker(false);
    setProposeTimes([]);
    if (v2Enabled) {
      // V2: the sheet starts empty — the person picks day and time (D57
      // preferences are general, never turned into availability).
      setProposeModalVisible(true);
      return;
    }
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

  // V2: send a suggestion (or a counter to theirs). The request id is fixed
  // per opening of the sheet, so a double tap or retry never creates two.
  async function confirmProposeV2(meetingAt: string, place: string | null) {
    if (!matchId || proposing) return;
    if (!isSendableTime(meetingAt)) {
      Alert.alert('Pick a later time', 'Choose a time at least a few minutes from now.');
      return;
    }
    setProposing(true);
    const selectedProposeTime = meetingAt;
    const requestId = proposeRequestRef.current ?? newRequestId();
    proposeRequestRef.current = requestId;
    const r = counterTarget
      ? await respondDate(counterTarget.id, 'counter', { meetingAt: selectedProposeTime, place, requestId })
      : await proposeDate(matchId, selectedProposeTime, place, requestId);
    setProposing(false);
    if (!r.ok) {
      Alert.alert('Could not send', r.message);
      return;
    }
    setProposeModalVisible(false);
    setCounterTarget(null);
    void refreshChatState();
  }

  async function answerProposal(p: Proposal, action: 'accept' | 'decline') {
    if (answering) return;
    setAnswering(p.id);
    const r = await respondDate(p.id, action);
    setAnswering(null);
    if (!r.ok) Alert.alert('Could not send your answer', r.message);
    void refreshChatState();
  }

  function openPlusMenu() {
    if (inputDisabled) return;
    Alert.alert('Add to chat', undefined, [
      { text: 'Suggest a date', onPress: () => void openProposeModal(null) },
      { text: 'Add a photo', onPress: handleAddPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function openChatMenu() {
    const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
      { text: 'View profile', onPress: openUserProfile },
    ];
    if (matchId && chatState?.active) {
      buttons.push({
        text: 'Unmatch',
        style: 'destructive',
        onPress: () =>
          Alert.alert(`Unmatch ${userName}?`, 'The conversation ends for both of you. This can’t be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Unmatch',
              style: 'destructive',
              onPress: async () => {
                const r = await unmatch(matchId);
                if (!r.ok) return Alert.alert('Could not unmatch', r.message);
                router.back();
              },
            },
          ]),
      });
    }
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(userName, undefined, buttons);
  }

  function renderProposal(p: Proposal) {
    const when = formatMeetingTime(p.meeting_at);
    const statusText =
      p.status === 'pending'
        ? p.mine
          ? 'Awaiting reply'
          : null
        : p.status === 'accepted'
          ? 'Accepted'
          : p.status === 'declined'
            ? 'Not now'
            : p.status === 'countered'
              ? 'Another time suggested'
              : 'Cancelled';
    const canAnswer = p.status === 'pending' && !p.mine && chatState?.active === true;
    const confirmed = p.status === 'accepted';
    const closed = p.status !== 'pending' && !confirmed;
    return (
      <View style={[styles.dateCard, confirmed && styles.dateCardConfirmed, closed && styles.dateCardClosed,
          p.mine ? styles.dateCardMine : styles.dateCardTheirs]}
        accessible={!canAnswer}
        accessibilityLabel={`${confirmed ? 'Plan confirmed' : 'Date suggestion'}. ${p.mine ? 'You suggested' : `${userName} suggested`} ${when}, ${p.place ?? 'decide the place together'}${statusText ? `. ${statusText}` : ''}`}>
        <View style={styles.dateCardHead}>
          <Ionicons name={confirmed ? 'checkmark-circle' : 'calendar-outline'} size={16} color={obColors.cta} />
          <ThemedText style={styles.dateCardKicker}>{confirmed ? 'Plan confirmed' : 'Date suggestion'}</ThemedText>
        </View>
        <ThemedText style={styles.dateCardTitle}>
          {p.mine ? 'You suggested' : `${userName} suggested`}
        </ThemedText>
        <ThemedText style={styles.dateCardWhen}>{when}</ThemedText>
        <ThemedText style={styles.dateCardPlace}>{p.place ?? 'Decide together'}</ThemedText>
        {statusText ? <ThemedText style={styles.dateCardStatus}>{statusText}</ThemedText> : null}
        {canAnswer ? (
          <View style={styles.dateCardActions}>
            <TouchableOpacity style={[styles.dateBtn, styles.dateBtnPrimary]} disabled={!!answering}
              onPress={() => void answerProposal(p, 'accept')} accessibilityRole="button" accessibilityLabel="Accept">
              {answering === p.id ? <ActivityIndicator color="#FFF" size="small" /> : <ThemedText style={styles.dateBtnPrimaryText}>Accept</ThemedText>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateBtn} disabled={!!answering}
              onPress={() => void openProposeModal(p)} accessibilityRole="button" accessibilityLabel="Suggest another time">
              <ThemedText style={styles.dateBtnText}>Suggest another time</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateBtn} disabled={!!answering}
              onPress={() => void answerProposal(p, 'decline')} accessibilityRole="button" accessibilityLabel="Not now">
              <ThemedText style={styles.dateBtnText}>Not now</ThemedText>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  }

  function openUserProfile() {
    if (!otherUserId) return;
    if (v2Enabled) {
      router.push(`/v2/profile?userId=${otherUserId}` as never);
      return;
    }
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
  // V2: the server decides whether this chat is still active (unmatched or
  // blocked chats end; their history stays readable).
  const chatEnded = v2Enabled && chatState !== null && chatState.active === false;
  const inputLocked = chatOpened === false || chatEnded;
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
  // V2 replaces this persistent bar with in-chat cards + the + menu.
  const meetupUiEnabled = !inputDisabled && !v2Enabled;
  type ChatItem = { kind: 'msg'; at: string; msg: Message } | { kind: 'date'; at: string; p: Proposal };
  const chatItems: ChatItem[] = [
    ...messages.map((m) => ({ kind: 'msg' as const, at: m.created_at, msg: m })),
    ...(v2Enabled ? (chatState?.proposals ?? []).map((p) => ({ kind: 'date' as const, at: p.created_at, p })) : []),
  ].sort((a, b) => a.at.localeCompare(b.at));
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
        {v2Enabled ? (
          <TouchableOpacity onPress={openChatMenu} style={styles.menuBtn} hitSlop={10}
            accessibilityRole="button" accessibilityLabel="More options">
            <Ionicons name="ellipsis-horizontal" size={22} color={obColors.textPrimary} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}>
        {gateError ? (
          <ErrorState onRetry={() => void resolveMatchAndGate()} />
        ) : chatLoading ? (
          <View style={styles.lockedWrap}>
            <ActivityIndicator color={obColors.cta} size="large" />
          </View>
        ) : inputLocked ? (
          <View style={styles.lockedWrap}>
            <ThemedText style={styles.lockedTitle}>{chatEnded ? 'This conversation has ended' : 'Chat is locked'}</ThemedText>
            <ThemedText style={styles.lockedText}>
              {chatEnded ? 'You can no longer send messages or suggest a date here.' : `Chat opens once ${userName} accepts.`}
            </ThemedText>
            {matchId ? (
              <ThemedText style={styles.lockedHint}>You can go back to Matches to wait.</ThemedText>
            ) : null}
          </View>
        ) : messagesError && messages.length === 0 ? (
          <ErrorState onRetry={() => void fetchMessages()} />
        ) : (
          <FlatList
            ref={flatListRef as never}
            data={chatItems}
            keyExtractor={(item) => (item.kind === 'msg' ? item.msg.id : `date-${item.p.id}`)}
            renderItem={({ item }) => {
              if (item.kind === 'date') return renderProposal(item.p);
              const index = messages.findIndex((m) => m.id === item.msg.id);
              return renderMessage({ item: item.msg, index });
            }}
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
            <Ionicons name="chevron-forward" size={16} color={obColors.cta} />
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
            onPress={v2Enabled ? openPlusMenu : handleAddPhoto}
            disabled={inputDisabled}
            accessibilityRole="button"
            accessibilityLabel={v2Enabled ? 'More: suggest a date or add a photo' : 'Add a photo'}>
            <Ionicons name={v2Enabled ? 'add' : 'camera-outline'} size={v2Enabled ? 26 : 22} color={obColors.textPrimary} />
          </TouchableOpacity>
          <TextInput
            ref={inputRef}
            style={[styles.input, inputDisabled && styles.inputDisabled]}
            placeholder={inputLocked ? 'Chat locked' : `Message ${userName}…`}
            placeholderTextColor={obColors.textSecondary}
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

    {v2Enabled ? (
      <SuggestDateSheet
        visible={proposeModalVisible}
        counter={!!counterTarget}
        otherName={userName}
        otherPhotoUrl={headerPhotoUrl}
        sending={proposing}
        onClose={() => {
          setProposeModalVisible(false);
          setCounterTarget(null);
        }}
        onSend={(iso, place) => void confirmProposeV2(iso, place)}
      />
    ) : (
    <Modal
      visible={proposeModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setProposeModalVisible(false)}>
      <KeyboardAvoidingView
        style={styles.proposeBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.proposeSheet}>
          <ThemedText style={styles.proposeTitle}>
            {!v2Enabled ? 'Suggest a time to meet up' : counterTarget ? 'Suggest another time' : 'Suggest a date'}
          </ThemedText>

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
          ) : null}
          {!(selectedProposeTime && !proposeTimes.includes(selectedProposeTime)) ? (
            <TouchableOpacity
              onPress={() => {
                // Start an hour ahead so "Use this time" is always sendable.
                setProposeTimePickerDraft(new Date(Date.now() + 60 * 60 * 1000));
                setShowProposeTimePicker(true);
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Pick another time">
              <ThemedText style={styles.proposeCustomLink}>Pick another time</ThemedText>
            </TouchableOpacity>
          ) : null}

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
            placeholderTextColor={obColors.textSecondary}
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
                <ThemedText style={styles.proposeConfirmBtnText}>{v2Enabled ? 'Send' : 'Suggest'}</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'flex-start', backgroundColor: obColors.background },
  proposeIdeasLabel: { fontSize: 13, lineHeight: 18, color: obColors.textSecondary, marginBottom: 6 },
  menuBtn: { width: 40, height: 40, alignItems: 'flex-end', justifyContent: 'center' },
  dateCard: {
    marginVertical: 8,
    maxWidth: '88%',
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#B9AF9B',
    backgroundColor: '#FFFDF8',
    padding: 14,
    gap: 4,
  },
  dateCardConfirmed: { borderStyle: 'solid', borderColor: obColors.cta, backgroundColor: obColors.selectedFill },
  dateCardClosed: { borderStyle: 'solid', borderColor: '#E4DCCB', opacity: 0.75 },
  dateCardMine: { alignSelf: 'flex-end' },
  dateCardTheirs: { alignSelf: 'flex-start' },
  dateCardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateCardKicker: { fontFamily: obFonts.bodySemiBold, fontSize: 12, lineHeight: 16, letterSpacing: 0.5, textTransform: 'uppercase', color: obColors.textSecondary },
  dateCardTitle: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  dateCardWhen: { fontFamily: obFonts.heading, fontSize: 20, lineHeight: 26, color: obColors.textPrimary },
  dateCardPlace: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textPrimary },
  dateCardStatus: { marginTop: 4, fontFamily: obFonts.bodyMedium, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  dateCardActions: { marginTop: 8, gap: 8 },
  dateBtn: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C9C0AF',
    backgroundColor: '#FFFDF8',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  dateBtnPrimary: { backgroundColor: obColors.cta, borderColor: obColors.cta },
  dateBtnPrimaryText: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: '#FFFFFF' },
  dateBtnText: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#E4DCCB',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  backText: { fontSize: 24, color: obColors.cta },
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
    backgroundColor: obColors.selectedFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitial: { fontSize: 14, fontWeight: '700', color: obColors.textPrimary },
  headerName: { fontFamily: obFonts.heading, fontSize: 19, lineHeight: 25, color: obColors.textPrimary },
  messagesList: { padding: 16, gap: 8, flexGrow: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: { color: obColors.textSecondary, fontSize: 14, textAlign: 'center' },
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
    color: obColors.textPrimary,
    textAlign: 'center',
  },
  lockedText: { fontSize: 15, color: obColors.textSecondary, textAlign: 'center', lineHeight: 22 },
  sendErrorText: {
    fontSize: 13,
    color: '#C0392B',
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  lockedHint: { fontSize: 13, color: obColors.textSecondary, textAlign: 'center', marginTop: 8 },
  iceWrap: {
    paddingTop: 4,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4DCCB',
  },
  iceTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: obColors.cta,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  iceSavedChip: {
    marginHorizontal: 12,
    backgroundColor: obColors.selectedFill,
    borderWidth: 1,
    borderColor: obColors.cta,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  iceChipText: {
    fontSize: 13,
    lineHeight: 18,
    color: obColors.textPrimary,
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
    backgroundColor: obColors.selectedFill,
    borderWidth: 1,
    borderColor: obColors.cta,
    borderRadius: 14,
    paddingVertical: 12,
  },
  iceQuizEmoji: { fontSize: 24 },
  iceQuizLabel: { fontSize: 13, fontWeight: '600', color: obColors.textPrimary },
  iceQuizOr: { fontSize: 12, color: obColors.textSecondary },
  meetupBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#F1ECE1',
    borderWidth: 1,
    borderColor: '#E4DCCB',
  },
  meetupBarIcon: { fontSize: 16 },
  meetupBarText: { flex: 1, fontSize: 13, fontWeight: '600', color: obColors.textPrimary },
  meetupRespondCard: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#F1ECE1',
    borderWidth: 1,
    borderColor: '#E4DCCB',
    gap: 10,
  },
  meetupRespondRow: { flexDirection: 'row', gap: 8 },
  meetupRespondBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#FFFDF8',
    borderWidth: 1,
    borderColor: '#E4DCCB',
  },
  meetupRespondBtnText: { fontSize: 13, fontWeight: '600', color: obColors.textPrimary },
  meetupRespondYes: { backgroundColor: obColors.cta, borderColor: obColors.cta },
  meetupRespondYesText: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  proposeBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  proposeSheet: {
    backgroundColor: '#FFFDF8',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
    gap: 14,
  },
  proposeTitle: { fontSize: 17, fontWeight: '700', color: obColors.textPrimary },
  slotChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    backgroundColor: '#F1ECE1',
    borderWidth: 1,
    borderColor: '#E4DCCB',
  },
  slotChipSelected: { backgroundColor: obColors.cta, borderColor: obColors.cta },
  slotChipText: { fontSize: 13, fontWeight: '600', color: obColors.textPrimary },
  slotChipTextSelected: { color: '#FFF' },
  proposeCustomLink: {
    fontSize: 13,
    fontWeight: '600',
    color: obColors.cta,
    textDecorationLine: 'underline',
  },
  proposeTimePickerColumn: { alignItems: 'stretch', gap: 8 },
  proposeAddSlotBtn: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: obColors.cta,
  },
  proposeAddSlotBtnText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  proposePlaceLabel: { fontSize: 13, fontWeight: '600', color: obColors.textSecondary },
  proposePlaceInput: {
    backgroundColor: '#F1ECE1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: obColors.textPrimary,
  },
  proposeBtnRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  proposeCancelBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#F1ECE1',
    borderWidth: 1,
    borderColor: '#E4DCCB',
  },
  proposeCancelBtnText: { fontSize: 14, fontWeight: '600', color: obColors.textPrimary },
  proposeConfirmBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: obColors.cta,
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
    backgroundColor: obColors.selectedFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgAvatarPlaceholderMine: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginLeft: 8,
    backgroundColor: obColors.selectedFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgAvatarInitial: { fontSize: 12, fontWeight: '700', color: obColors.textPrimary },
  bubble: {
    maxWidth: '75%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleMine: {
    backgroundColor: obColors.cta,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: '#FFFDF8',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E4DCCB',
  },
  bubbleText: { fontFamily: obFonts.body, fontSize: 15.5, color: obColors.textPrimary, lineHeight: 22 },
  bubbleTextMine: { color: '#FFF' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#E4DCCB',
    backgroundColor: '#FFFDF8',
  },
  inputRowLocked: { opacity: 0.85 },
  attachBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F1ECE1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F1ECE1',
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: obColors.textPrimary,
    maxHeight: 100,
  },
  inputDisabled: { backgroundColor: '#F1ECE1', color: obColors.textSecondary },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: obColors.cta,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
