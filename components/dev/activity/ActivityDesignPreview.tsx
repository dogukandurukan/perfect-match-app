// DEV-only interactive preview of the Activity → Profile → Match & chat flow
// (mockup 2026-10-12, D75–D81). One vertical feed: large photo cards for
// incoming interest, small "You and X matched" rows for matches. Local
// fixtures and a pure reducer only (lib/dev/activityPreview.ts): no Supabase
// import, so no like, match, message or read state changes on any account.
// The real Activity tab (app/(tabs)/notifications.tsx) is unchanged.
//
// Reuses the shared pieces of the real screens: the full V2 profile layout
// (DiscoverProfileItems, read-only) and the chat's like context
// (LikeContextHeader). Opened from app/dev/activity-preview.tsx.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LikeContextHeader } from '@/components/chat/LikeContext';
import { activityPhoto } from '@/components/dev/activity/previewPhotos';
import { PreviewTabBar } from '@/components/dev/discover/PreviewTabBar';
import { DiscoverProfileItems, type ItemHandlers } from '@/components/discover/DiscoverProfileItems';
import {
  activityReducer,
  buildFeed,
  conversationStarted,
  INITIAL_ACTIVITY,
  interestFor,
  interestLabel,
  interestLine,
  MATCH_COPY,
  matchedLine,
  matchedWhen,
  matchFor,
  ME_ID,
  personOf,
  personPlace,
  timeAgo,
  timeAgoLong,
  type ActivityAction,
  type ActivityState,
  type Interest,
  type LikeTarget,
  type Match,
} from '@/lib/dev/activityPreview';
import { buildDiscoverLayout } from '@/lib/discover/profileLayout';
import type { LikeContext as LikeItem } from '@/lib/matchChatV2';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

const FADE = require('../../../assets/images/discover-fade.png');
const SURFACE = '#FFFDF8';
const CARD_BORDER = '#E4DCCB';
const SAGE = obColors.selectedFill;
const HEADER_HEIGHT = 56;
/** Info strip under a card photo (meta + up to two comment lines). */
const CARD_INFO = 92;
const CARD_GAP = obSpacing.md;
/** Simulated network time for Match & chat. */
const MATCH_DELAY_MS = 600;

type Screen = { kind: 'home' } | { kind: 'profile'; personId: string } | { kind: 'chat'; matchId: string };

const noop = () => {};

export function ActivityDesignPreview({ onExit }: { onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const [state, dispatch] = useReducer(activityReducer, INITIAL_ACTIVITY);
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });

  // Match & chat: simulated request; on success open the chat directly.
  const awaitingChat = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  useEffect(() => {
    const pid = awaitingChat.current;
    if (!pid || state.matching) return;
    awaitingChat.current = null;
    const m = matchFor(state, pid);
    if (m) {
      dispatch({ type: 'open_chat', matchId: m.id });
      setScreen({ kind: 'chat', matchId: m.id });
    }
  }, [state]);

  const openProfile = (personId: string) => {
    dispatch({ type: 'open_profile', personId });
    setScreen({ kind: 'profile', personId });
  };
  const openChat = (matchId: string) => {
    dispatch({ type: 'open_chat', matchId });
    setScreen({ kind: 'chat', matchId });
  };
  const matchAndChat = (personId: string) => {
    const existing = matchFor(state, personId);
    if (existing) return openChat(existing.id);
    if (state.matching) return;
    dispatch({ type: 'match_start', personId });
    awaitingChat.current = personId;
    timer.current = setTimeout(() => dispatch({ type: 'match_done', personId }), MATCH_DELAY_MS);
  };
  // Leaving a profile while Match & chat is in flight: the match still
  // completes (it was asked for), but the chat isn't forced open.
  const home = () => {
    awaitingChat.current = null;
    setScreen({ kind: 'home' });
  };

  if (screen.kind === 'profile') {
    return (
      <ProfileView
        state={state}
        personId={screen.personId}
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        onBack={home}
        onMatch={() => matchAndChat(screen.personId)}
      />
    );
  }
  if (screen.kind === 'chat') {
    const m = state.matches.find((x) => x.id === screen.matchId);
    if (m) {
      return (
        <ChatView
          match={m}
          insetsTop={insets.top}
          insetsBottom={insets.bottom}
          onBack={home}
          onSend={(text) => dispatch({ type: 'send_message', matchId: m.id, text })}
        />
      );
    }
  }

  // About two cards fit on a normal phone; on small phones the photo gets
  // shorter, the text never does.
  const tabBar = 48 + Math.max(insets.bottom, 8);
  const feedHeight = winH - insets.top - HEADER_HEIGHT - tabBar - obSpacing.sm;
  const photoHeight = Math.round(Math.min(300, Math.max(170, feedHeight / 2 - CARD_INFO - CARD_GAP)));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.4}>Activity</Text>
        <TouchableOpacity onPress={onExit} hitSlop={10} accessibilityRole="button" accessibilityLabel="Exit Activity design preview">
          <Text style={styles.devPill}>DEV ✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.feed}>
        <Feed state={state} dispatch={dispatch} photoHeight={photoHeight} onOpenProfile={openProfile} onOpenChat={openChat} />
        <DevPanel state={state} onAction={dispatch} onExit={onExit} />
      </ScrollView>
      <PreviewTabBar bottomInset={insets.bottom} active="Activity" />
    </View>
  );
}

function Feed({
  state,
  dispatch,
  photoHeight,
  onOpenProfile,
  onOpenChat,
}: {
  state: ActivityState;
  dispatch: (a: ActivityAction) => void;
  photoHeight: number;
  onOpenProfile: (personId: string) => void;
  onOpenChat: (matchId: string) => void;
}) {
  if (state.load === 'loading') {
    return (
      <View style={styles.stateBody} accessibilityLiveRegion="polite">
        <ActivityIndicator color={obColors.cta} />
        <Text style={styles.stateText}>Loading your activity…</Text>
      </View>
    );
  }
  if (state.load === 'error') {
    return (
      <View style={styles.stateBody} accessibilityLiveRegion="polite">
        <Ionicons name="cloud-offline-outline" size={36} color={obColors.cta} importantForAccessibility="no" />
        <Text style={styles.stateTitle} accessibilityRole="header">Couldn’t load activity</Text>
        <Text style={styles.stateText}>Check your connection and try again.</Text>
        <TouchableOpacity onPress={() => dispatch({ type: 'retry' })} style={styles.retry} accessibilityRole="button">
          <Text style={styles.primaryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const feed = buildFeed(state);
  if (feed.length === 0) {
    return (
      <View style={styles.stateBody}>
        <Ionicons name="heart-outline" size={36} color={obColors.cta} importantForAccessibility="no" />
        <Text style={styles.stateTitle} accessibilityRole="header">{MATCH_COPY.emptyTitle}</Text>
        <Text style={styles.stateText}>{MATCH_COPY.emptyText}</Text>
      </View>
    );
  }
  return (
    <View style={{ gap: CARD_GAP }}>
      {feed.map((f) =>
        f.kind === 'interest' ? (
          <InterestCard key={f.key} interest={f.interest} photoHeight={photoHeight} onPress={() => onOpenProfile(f.interest.personId)} />
        ) : (
          <MatchRow key={f.key} match={f.match} onPress={() => onOpenChat(f.match.id)} />
        ),
      )}
    </View>
  );
}

function UnreadDot({ show }: { show: boolean }) {
  return show ? <View style={styles.dot} /> : null;
}

/** My liked photo as a small thumbnail (photo likes only). */
function MyThumb({ target, size }: { target: LikeTarget; size: { width: number; height: number } }) {
  const src = target.kind === 'photo' ? activityPhoto(ME_ID, target.myPhotoIndex) : null;
  return src ? <Image source={src} style={[styles.thumb, size]} contentFit="cover" accessible={false} /> : null;
}

function InterestCard({ interest, photoHeight, onPress }: { interest: Interest; photoHeight: number; onPress: () => void }) {
  const p = personOf(interest.personId);
  const place = personPlace(interest.personId);
  const photo = activityPhoto(interest.personId, 0);
  const label = interestLabel(interest.target);
  const a11y = [
    `${p.name}, ${p.age}${place ? `, ${place}` : ''}`,
    `${label}, ${timeAgoLong(interest.minutesAgo)}`,
    interest.target.kind === 'prompt' ? `Your answer: ${interest.target.answer}` : null,
    interest.comment ? `Comment: ${interest.comment}` : null,
    interest.read ? null : 'New',
  ].filter(Boolean).join('. ');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Opens the full profile">
      <View style={{ height: photoHeight }}>
        {photo ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} /> : <View style={[StyleSheet.absoluteFill, styles.photoFallback]} />}
        <Image source={FADE} style={styles.fade} contentFit="fill" accessible={false} />
        <View style={styles.cardName}>
          <Text style={styles.cardNameText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{`${p.name}, ${p.age}`}</Text>
          {place ? (
            <View style={styles.placeRow}>
              <Ionicons name="location-sharp" size={14} color="#FFFFFF" />
              <Text style={styles.placeText} numberOfLines={1} maxFontSizeMultiplier={1.3}>{place}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.cardInfo}>
        <View style={styles.cardInfoText}>
          <View style={styles.metaRow}>
            <Text style={styles.meta} numberOfLines={1}>{`${label} · ${timeAgo(interest.minutesAgo)}`}</Text>
            <UnreadDot show={!interest.read} />
          </View>
          {interest.target.kind === 'prompt' ? (
            <Text style={styles.yourAnswer} numberOfLines={1}>{`Your answer: ${interest.target.answer}`}</Text>
          ) : null}
          {interest.comment ? (
            <Text style={styles.quote} numberOfLines={2}>{`“${interest.comment}”`}</Text>
          ) : null}
        </View>
        <MyThumb target={interest.target} size={{ width: 76, height: 58 }} />
      </View>
    </Pressable>
  );
}

function MatchRow({ match, onPress }: { match: Match; onPress: () => void }) {
  const p = personOf(match.personId);
  const photo = activityPhoto(match.personId, 0);
  const sub = conversationStarted(match) ? `Conversation started · ${timeAgo(match.minutesAgo)}` : timeAgoLong(match.minutesAgo);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.matchRow, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`${matchedLine(p.name)}. ${sub}${match.read ? '' : '. New'}`}
      accessibilityHint="Opens your chat">
      {photo ? <Image source={photo} style={styles.matchAvatar} contentFit="cover" accessible={false} /> : <View style={styles.matchAvatar} />}
      <View style={styles.matchText}>
        <Text style={styles.matchTitle} numberOfLines={2} maxFontSizeMultiplier={1.4}>{matchedLine(p.name)}</Text>
        <Text style={styles.meta} numberOfLines={1}>{sub}</Text>
      </View>
      <UnreadDot show={!match.read} />
      <Ionicons name="chevron-forward" size={20} color={obColors.textSecondary} importantForAccessibility="no" />
    </Pressable>
  );
}

// ─── Profile: the full V2 profile, read-only, + one accept action ──────────

function ProfileView({
  state,
  personId,
  insetsTop,
  insetsBottom,
  onBack,
  onMatch,
}: {
  state: ActivityState;
  personId: string;
  insetsTop: number;
  insetsBottom: number;
  onBack: () => void;
  onMatch: () => void;
}) {
  const { height } = useWindowDimensions();
  const person = personOf(personId);
  const items = useMemo(() => buildDiscoverLayout(person), [person]);
  const interest = interestFor(state, personId);
  const match = matchFor(state, personId);
  const context = interest ?? (match?.started && !match.started.fromMe ? { target: match.started.target, comment: match.started.comment } : null);
  const busy = state.matching === personId;
  const failed = state.matchError === personId;
  const handlers: ItemHandlers = {
    person,
    photoSource: (i) => activityPhoto(person.id, i),
    heroHeight: Math.max(340, Math.round(height * 0.56)),
    editor: null,
    canLike: false,
    liked: false,
    sent: null,
    readOnly: true,
    onLike: noop,
    onOpenComment: noop,
    onEditComment: noop,
    onCancelComment: noop,
    onSendComment: noop,
    onEditorResize: noop,
    editorRef: noop,
  };
  return (
    <View style={[styles.root, { paddingTop: insetsTop }]}>
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to Activity" style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={obColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.subTitle} numberOfLines={1} accessibilityRole="header">{`${person.name}, ${person.age}`}</Text>
        <View style={styles.iconBtn}>
          <Text style={styles.devPill}>DEV</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: obSpacing.xl }}>
        <DiscoverProfileItems items={items.slice(0, 1)} h={handlers} />
        {context ? (
          <View style={styles.profileContext} accessible accessibilityLabel={`${interestLine(person.name, context.target)}${context.comment ? `: ${context.comment}` : ''}`}>
            <MyThumb target={context.target} size={{ width: 84, height: 64 }} />
            <View style={styles.cardInfoText}>
              <Text style={styles.meta}>{interestLabel(context.target)}</Text>
              {context.target.kind === 'prompt' ? (
                <Text style={styles.yourAnswer}>{`Your answer: ${context.target.answer}`}</Text>
              ) : null}
              {context.comment ? <Text style={styles.quote}>{`“${context.comment}”`}</Text> : null}
            </View>
          </View>
        ) : null}
        <DiscoverProfileItems items={items.slice(1)} h={handlers} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insetsBottom, obSpacing.md) }]}>
        {failed && !match ? (
          <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">{MATCH_COPY.error}</Text>
        ) : null}
        <TouchableOpacity
          onPress={onMatch}
          disabled={busy}
          style={[styles.primary, busy && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          accessibilityLabel={match ? `${MATCH_COPY.open} with ${person.name}` : `${MATCH_COPY.cta} with ${person.name}`}>
          {busy ? <ActivityIndicator color={obColors.onCta} /> : <Text style={styles.primaryText}>{match ? MATCH_COPY.open : MATCH_COPY.cta}</Text>}
        </TouchableOpacity>
        {!match ? <Text style={styles.caption}>{MATCH_COPY.caption(person.name)}</Text> : null}
      </View>
    </View>
  );
}

// ─── Chat: the real chat's like context + a local, send-nothing composer ───

/** The match's "how it started" as the chat's LikeContext items. A photo
 * path points at whose photo was liked (`<personId>:<index>`). */
function startedItems(m: Match): LikeItem[] {
  if (!m.started) return [];
  const t = m.started.target;
  const owner = m.started.fromMe ? m.personId : ME_ID;
  return [
    {
      from_me: m.started.fromMe,
      target_type: t.kind,
      note: m.started.comment,
      created_at: `preview-${m.id}`,
      photo_path: t.kind === 'photo' ? `${owner}:${t.myPhotoIndex}` : null,
      prompt_id: t.kind === 'prompt' ? t.promptId : null,
      answer: t.kind === 'prompt' ? t.answer : null,
    },
  ];
}
const contextPhoto = (item: LikeItem) => {
  const [who, i] = (item.photo_path ?? '').split(':');
  return who ? activityPhoto(who, Number(i)) : null;
};

function ChatView({
  match,
  insetsTop,
  insetsBottom,
  onBack,
  onSend,
}: {
  match: Match;
  insetsTop: number;
  insetsBottom: number;
  onBack: () => void;
  onSend: (text: string) => void;
}) {
  const p = personOf(match.personId);
  const avatar = activityPhoto(match.personId, 0);
  const [draft, setDraft] = useState('');
  const started = conversationStarted(match);
  const canSend = draft.trim().length > 0;
  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insetsTop }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.chatHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to Activity" style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={26} color={obColors.textPrimary} />
        </TouchableOpacity>
        {avatar ? <Image source={avatar} style={styles.chatAvatar} contentFit="cover" accessible={false} /> : null}
        <Text style={styles.chatName} numberOfLines={1} accessibilityRole="header">{p.name}</Text>
        <Text style={styles.devPill}>DEV</Text>
      </View>
      <ScrollView contentContainerStyle={styles.chatContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.matchedWhen}>{matchedWhen(match.minutesAgo)}</Text>
        {/* Context only — the like / comment is never a message. */}
        <View style={styles.howItStarted}>
          <LikeContextHeader likes={startedItems(match)} otherName={p.name} title={MATCH_COPY.howItStarted} photoSource={contextPhoto} />
        </View>
        {started ? (
          match.messages.map((m) => (
            <View key={m.id} style={[styles.bubble, m.fromMe ? styles.mine : styles.theirs]}>
              <Text style={[styles.bubbleText, m.fromMe && { color: obColors.onCta }]}>{m.text}</Text>
            </View>
          ))
        ) : (
          <View style={styles.hello}>
            <Ionicons name="chatbubble-outline" size={44} color={obColors.border} importantForAccessibility="no" />
            <Text style={styles.helloTitle}>{MATCH_COPY.hello(p.name)}</Text>
            <Text style={styles.stateText}>{MATCH_COPY.helloText}</Text>
          </View>
        )}
      </ScrollView>
      <View style={[styles.inputRow, { paddingBottom: Math.max(insetsBottom, obSpacing.sm) }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`Message ${p.name}…`}
          placeholderTextColor={obColors.textSecondary}
          style={styles.input}
          multiline
          maxLength={1000}
          accessibilityLabel={`Message to ${p.name}`}
        />
        <TouchableOpacity
          onPress={() => {
            onSend(draft);
            setDraft('');
          }}
          disabled={!canSend}
          style={[styles.send, !canSend && { backgroundColor: obColors.ctaDisabled }]}
          accessibilityRole="button"
          accessibilityLabel="Send (preview only, nothing leaves the phone)"
          accessibilityState={{ disabled: !canSend }}>
          <Ionicons name="send" size={18} color={obColors.onCta} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function DevPanel({ state, onAction, onExit }: { state: ActivityState; onAction: (a: ActivityAction) => void; onExit: () => void }) {
  const btn = (label: string, onPress: () => void) => (
    <TouchableOpacity key={label} onPress={onPress} style={styles.devBtn} accessibilityRole="button">
      <Text style={styles.devBtnText} maxFontSizeMultiplier={1.4}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.dev}>
      <Text style={styles.devTitle}>Preview controls · DEV</Text>
      <Text style={styles.devText}>
        Local sample data only. Nothing is liked, matched, read or sent on any account. Photos are illustrated placeholders.
      </Text>
      <View style={styles.devRow}>
        {btn('Normal', () => onAction({ type: 'scenario', scenario: 'normal' }))}
        {btn('Empty', () => onAction({ type: 'scenario', scenario: 'empty' }))}
        {btn('Loading', () => onAction({ type: 'scenario', scenario: 'loading' }))}
        {btn('Error', () => onAction({ type: 'scenario', scenario: 'error' }))}
        {btn(state.failNext ? 'Next Match & chat fails: ON' : 'Next Match & chat fails: off', () => onAction({ type: 'dev_fail_next', on: !state.failNext }))}
        {btn('Reset', () => onAction({ type: 'reset' }))}
        {btn('Exit preview', onExit)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.sm,
    paddingHorizontal: obSpacing.lg + 4,
  },
  title: { fontFamily: obFonts.heading, fontSize: 32, lineHeight: 40, color: obColors.textPrimary },
  devPill: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
    color: '#8A5A00',
    backgroundColor: '#F3E4C4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  feed: { paddingHorizontal: obSpacing.sm + 2, paddingTop: obSpacing.xs, paddingBottom: obSpacing.xl },
  card: { borderRadius: 16, overflow: 'hidden', backgroundColor: SURFACE, borderWidth: 1, borderColor: CARD_BORDER },
  photoFallback: { backgroundColor: obColors.notice },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  cardName: { position: 'absolute', left: obSpacing.md + 2, right: obSpacing.md, bottom: obSpacing.md },
  cardNameText: { fontFamily: obFonts.heading, fontSize: 26, lineHeight: 33, color: '#FFFFFF' },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  placeText: { flexShrink: 1, fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: '#FFFFFF' },
  cardInfo: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md, paddingHorizontal: obSpacing.md + 2, paddingVertical: obSpacing.md, backgroundColor: SAGE },
  cardInfoText: { flex: 1, minWidth: 0, gap: 3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm },
  meta: { flexShrink: 1, fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  yourAnswer: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  quote: { fontFamily: obFonts.heading, fontSize: 18, lineHeight: 25, color: obColors.textPrimary },
  thumb: { borderRadius: 8, backgroundColor: obColors.notice },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: obColors.cta },
  matchRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.md,
    paddingHorizontal: obSpacing.md,
    paddingVertical: obSpacing.sm + 2,
    borderRadius: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  matchAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: obColors.notice },
  matchText: { flex: 1, minWidth: 0, gap: 2 },
  matchTitle: { fontFamily: obFonts.bodyMedium, fontSize: 16, lineHeight: 21, color: obColors.textPrimary },
  stateBody: { alignItems: 'center', gap: obSpacing.md, paddingHorizontal: obSpacing.lg, paddingVertical: obSpacing.xxl * 2 },
  stateTitle: { fontFamily: obFonts.heading, fontSize: 24, lineHeight: 31, color: obColors.textPrimary, textAlign: 'center' },
  stateText: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary, textAlign: 'center' },
  retry: { minHeight: 48, paddingHorizontal: obSpacing.xl, borderRadius: 14, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
  primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: obColors.cta },
  primaryText: { fontFamily: obFonts.bodySemiBold, fontSize: 17, lineHeight: 22, color: obColors.onCta },
  caption: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary, textAlign: 'center', marginTop: obSpacing.sm },
  error: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.error, textAlign: 'center', marginBottom: obSpacing.sm },
  subHeader: { minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: obSpacing.sm },
  iconBtn: { width: 48, height: 44, alignItems: 'center', justifyContent: 'center' },
  subTitle: { flex: 1, textAlign: 'center', fontFamily: obFonts.heading, fontSize: 22, lineHeight: 29, color: obColors.textPrimary },
  profileContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.md,
    marginHorizontal: obSpacing.md,
    marginTop: obSpacing.md,
    padding: obSpacing.md,
    borderRadius: 14,
    backgroundColor: SAGE,
  },
  footer: { paddingHorizontal: obSpacing.lg, paddingTop: obSpacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: CARD_BORDER, backgroundColor: obColors.background },
  chatHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.sm,
    paddingHorizontal: obSpacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: CARD_BORDER,
  },
  chatAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: obColors.notice },
  chatName: { flex: 1, fontFamily: obFonts.heading, fontSize: 20, lineHeight: 27, color: obColors.textPrimary },
  chatContent: { flexGrow: 1, padding: obSpacing.lg, gap: obSpacing.sm },
  matchedWhen: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary, textAlign: 'center', marginBottom: obSpacing.sm },
  howItStarted: { padding: obSpacing.md, paddingBottom: 0, borderRadius: 16, backgroundColor: '#EFEDE3' },
  hello: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: obSpacing.sm, paddingVertical: obSpacing.xxl },
  helloTitle: { fontFamily: obFonts.heading, fontSize: 24, lineHeight: 31, color: obColors.textPrimary, textAlign: 'center' },
  bubble: { maxWidth: '80%', paddingHorizontal: obSpacing.md, paddingVertical: obSpacing.sm, borderRadius: 16 },
  mine: { alignSelf: 'flex-end', backgroundColor: obColors.cta },
  theirs: { alignSelf: 'flex-start', backgroundColor: SURFACE, borderWidth: 1, borderColor: CARD_BORDER },
  bubbleText: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textPrimary },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: obSpacing.sm, paddingHorizontal: obSpacing.md, paddingTop: obSpacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: CARD_BORDER },
  input: { flex: 1, minHeight: 46, maxHeight: 120, paddingHorizontal: obSpacing.md + 2, paddingVertical: 12, borderRadius: 23, backgroundColor: SURFACE, borderWidth: 1, borderColor: CARD_BORDER, fontFamily: obFonts.body, fontSize: 16, color: obColors.textPrimary },
  send: { width: 46, height: 46, borderRadius: 23, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
  dev: {
    marginTop: obSpacing.xl,
    gap: obSpacing.sm,
    padding: obSpacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: obColors.border,
    backgroundColor: obColors.notice,
  },
  devTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: obColors.textPrimary },
  devText: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  devRow: { flexDirection: 'row', flexWrap: 'wrap', gap: obSpacing.sm },
  devBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: obSpacing.md, borderRadius: 10, borderWidth: 1, borderColor: obColors.border, backgroundColor: SURFACE },
  devBtnText: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
});
