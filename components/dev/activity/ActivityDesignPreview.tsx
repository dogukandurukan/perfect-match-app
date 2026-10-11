// DEV-only interactive preview of the proposed Activity tab: "Likes you"
// (who liked which of my photos / answers, with their comment next to that
// content) and "New matches" (small rows with Open chat). Local fixtures and
// a pure reducer only (lib/dev/activityPreview.ts): no Supabase import, so no
// like, match, message or read state changes on any account. The real
// Activity tab (app/(tabs)/notifications.tsx) is unchanged.
// Opened from app/dev/activity-preview.tsx.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useReducer, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { activityPhoto } from '@/components/dev/activity/previewPhotos';
import { PreviewTabBar } from '@/components/dev/discover/PreviewTabBar';
import { DiscoverProfileItems, type ItemHandlers } from '@/components/discover/DiscoverProfileItems';
import {
  activityReducer,
  conversationStarted,
  INITIAL_ACTIVITY,
  likedWhat,
  matchSubtitle,
  ME_ID,
  pendingCount,
  personOf,
  promptQuestion,
  showMarkAllRead,
  timeAgo,
  type ActivityAction,
  type ActivityState,
  type LikeTarget,
  type NewMatch,
  type PendingLike,
} from '@/lib/dev/activityPreview';
import { buildDiscoverLayout } from '@/lib/discover/profileLayout';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

const SURFACE = '#FFFDF8';
const CARD_BORDER = '#E4DCCB';
const SAGE = obColors.selectedFill;

type Screen = { kind: 'home' } | { kind: 'profile'; likeId: string; personId: string } | { kind: 'chat'; matchId: string };

const noop = () => {};

export function ActivityDesignPreview({ onExit }: { onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const [state, dispatch] = useReducer(activityReducer, INITIAL_ACTIVITY);
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });

  const openProfile = (like: PendingLike) => {
    dispatch({ type: 'open_profile', likeId: like.id });
    setScreen({ kind: 'profile', likeId: like.id, personId: like.personId });
  };
  const openChat = (matchId: string) => {
    dispatch({ type: 'open_chat', matchId });
    setScreen({ kind: 'chat', matchId });
  };
  const home = () => setScreen({ kind: 'home' });

  if (screen.kind === 'profile') {
    return (
      <ProfileView
        state={state}
        likeId={screen.likeId}
        personId={screen.personId}
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        onBack={home}
        onLikeBack={() => dispatch({ type: 'like_back', likeId: screen.likeId })}
        onOpenChat={openChat}
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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.4}>Activity</Text>
          <TouchableOpacity onPress={onExit} hitSlop={10} accessibilityRole="button" accessibilityLabel="Exit Activity design preview">
            <Text style={styles.devPill}>DEV ✕</Text>
          </TouchableOpacity>
        </View>
        {showMarkAllRead(state) ? (
          <TouchableOpacity onPress={() => dispatch({ type: 'mark_all_read' })} hitSlop={10} accessibilityRole="button" style={styles.markAll}>
            <Text style={styles.markAllText} maxFontSizeMultiplier={1.4}>Mark all as read</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <HomeBody state={state} dispatch={dispatch} onOpenProfile={openProfile} onOpenChat={openChat} />
        <DevPanel onAction={dispatch} onExit={onExit} />
      </ScrollView>

      <PreviewTabBar bottomInset={insets.bottom} active="Activity" />
    </View>
  );
}

function HomeBody({
  state,
  dispatch,
  onOpenProfile,
  onOpenChat,
}: {
  state: ActivityState;
  dispatch: (a: ActivityAction) => void;
  onOpenProfile: (l: PendingLike) => void;
  onOpenChat: (id: string) => void;
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
        <TouchableOpacity onPress={() => dispatch({ type: 'retry' })} style={styles.primary} accessibilityRole="button">
          <Text style={styles.primaryText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (state.likes.length === 0 && state.matches.length === 0) {
    return (
      <View style={styles.stateBody}>
        <Ionicons name="notifications-outline" size={36} color={obColors.cta} importantForAccessibility="no" />
        <Text style={styles.stateTitle} accessibilityRole="header">Nothing new yet</Text>
        <Text style={styles.stateText}>When someone likes your photo or answer, you’ll see it here.</Text>
      </View>
    );
  }
  const pending = pendingCount(state);
  return (
    <>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle} accessibilityRole="header">Likes you</Text>
        {pending > 0 ? (
          <View style={styles.countPill} accessible accessibilityLabel={`${pending} waiting`}>
            <Text style={styles.countText}>{pending}</Text>
          </View>
        ) : null}
      </View>
      {state.likes.length === 0 ? (
        <Text style={styles.sectionEmpty}>No one is waiting for an answer.</Text>
      ) : (
        <View style={styles.list}>
          {state.likes.map((l) => (
            <LikeCard key={l.id} like={l} onView={() => onOpenProfile(l)} />
          ))}
        </View>
      )}

      {state.matches.length > 0 ? (
        <>
          <View style={[styles.sectionHead, { marginTop: obSpacing.xl }]}>
            <Text style={styles.sectionTitle} accessibilityRole="header">New matches</Text>
          </View>
          <View style={styles.matchList}>
            {state.matches.map((m) => (
              <MatchRow key={m.id} match={m} onOpen={() => onOpenChat(m.id)} />
            ))}
          </View>
        </>
      ) : null}
    </>
  );
}

function UnreadDot({ show }: { show: boolean }) {
  return show ? <View style={styles.dot} accessible accessibilityLabel="Unread" /> : null;
}

/** My liked content (photo thumb or prompt) with their comment next to it. */
function LikedContent({ target, comment, compact }: { target: LikeTarget; comment: string | null; compact?: boolean }) {
  const src = target.kind === 'photo' ? activityPhoto(ME_ID, target.myPhotoIndex) : null;
  return (
    <View style={styles.context}>
      {target.kind === 'photo' ? (
        src ? <Image source={src} style={styles.contextThumb} contentFit="cover" accessible={false} /> : null
      ) : (
        <View style={styles.contextPrompt}>
          <Text style={styles.contextPromptLabel} numberOfLines={compact ? 1 : undefined}>{promptQuestion(target)}</Text>
          <Text style={styles.contextPromptAnswer} numberOfLines={compact ? 2 : undefined}>{target.answer}</Text>
        </View>
      )}
      {target.kind === 'photo' || comment ? (
        <View style={styles.contextText}>
          <Text style={styles.contextWhat}>{target.kind === 'photo' ? likedWhat(target) : 'Their comment'}</Text>
          {comment ? (
            <Text style={styles.comment} numberOfLines={compact ? 3 : undefined}>{`“${comment}”`}</Text>
          ) : (
            <Text style={styles.noComment}>No comment</Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

function LikeCard({ like, onView }: { like: PendingLike; onView: () => void }) {
  const p = personOf(like.personId);
  const photo = activityPhoto(like.personId, 0);
  const a11y = `${p.name}, ${p.age}. ${likedWhat(like.target)}. ${like.comment ? `Comment: ${like.comment}` : 'No comment'}. ${timeAgo(like.minutesAgo)}${like.read ? '' : '. Unread'}`;
  return (
    <View style={styles.card}>
      <View style={styles.cardTop} accessible accessibilityLabel={a11y}>
        {photo ? <Image source={photo} style={styles.avatar} contentFit="cover" accessible={false} /> : <View style={styles.avatar} />}
        <View style={styles.cardWho}>
          <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.4}>
            {p.name}, {p.age}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>{`${likedWhat(like.target)} · ${timeAgo(like.minutesAgo)}`}</Text>
        </View>
        <UnreadDot show={!like.read} />
      </View>
      <LikedContent target={like.target} comment={like.comment} compact />
      <TouchableOpacity onPress={onView} style={styles.secondary} accessibilityRole="button" accessibilityLabel={`View ${p.name}’s profile`}>
        <Text style={styles.secondaryText}>View profile</Text>
        <Ionicons name="chevron-forward" size={16} color={obColors.cta} importantForAccessibility="no" />
      </TouchableOpacity>
    </View>
  );
}

function MatchRow({ match, onOpen }: { match: NewMatch; onOpen: () => void }) {
  const p = personOf(match.personId);
  const photo = activityPhoto(match.personId, 0);
  return (
    <View style={styles.matchRow}>
      {photo ? <Image source={photo} style={styles.matchAvatar} contentFit="cover" accessible={false} /> : <View style={styles.matchAvatar} />}
      <View style={styles.cardWho} accessible accessibilityLabel={`${p.name}. ${matchSubtitle(match)}. ${timeAgo(match.minutesAgo)}${match.read ? '' : '. Unread'}`}>
        <Text style={styles.name} numberOfLines={1} maxFontSizeMultiplier={1.4}>{p.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>{`${matchSubtitle(match)} · ${timeAgo(match.minutesAgo)}`}</Text>
      </View>
      <UnreadDot show={!match.read} />
      <TouchableOpacity onPress={onOpen} style={styles.openChat} accessibilityRole="button" accessibilityLabel={`Open chat with ${p.name}`}>
        <Text style={styles.openChatText} maxFontSizeMultiplier={1.3}>Open chat</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Profile (shared Discover layout, read-only) ───────────────────────────

function ProfileView({
  state,
  likeId,
  personId,
  insetsTop,
  insetsBottom,
  onBack,
  onLikeBack,
  onOpenChat,
}: {
  state: ActivityState;
  likeId: string;
  personId: string;
  insetsTop: number;
  insetsBottom: number;
  onBack: () => void;
  onLikeBack: () => void;
  onOpenChat: (matchId: string) => void;
}) {
  const { height } = useWindowDimensions();
  const person = personOf(personId);
  const items = useMemo(() => buildDiscoverLayout(person), [person]);
  const like = state.likes.find((l) => l.id === likeId) ?? null;
  const match = like ? null : state.matches.find((m) => m.personId === personId) ?? null;
  const handlers: ItemHandlers = {
    person,
    photoSource: (i) => activityPhoto(person.id, i),
    heroHeight: Math.max(360, Math.round(height * 0.6)),
    editor: null,
    // Read-only here: liking back is the one explicit action below.
    canLike: false,
    liked: false,
    sent: null,
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
        <TouchableOpacity onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to Activity" style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={obColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.subTitle} numberOfLines={1}>{person.name}</Text>
        <Text style={styles.devPill}>DEV</Text>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: obSpacing.xl }}>
        {like ? (
          <View style={styles.profileContext}>
            <Text style={styles.contextHeading}>{`${person.name} ${likedWhat(like.target).replace('Liked', 'liked')}`}</Text>
            <LikedContent target={like.target} comment={like.comment} />
          </View>
        ) : null}
        <DiscoverProfileItems items={items} h={handlers} />
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insetsBottom, obSpacing.md) }]}>
        {like ? (
          <TouchableOpacity onPress={onLikeBack} style={styles.primary} accessibilityRole="button" accessibilityLabel={`Like ${person.name} back`}>
            <Ionicons name="heart" size={18} color={obColors.onCta} importantForAccessibility="no" />
            <Text style={styles.primaryText}>Like back</Text>
          </TouchableOpacity>
        ) : match ? (
          <View style={styles.matchedRow}>
            <Text style={styles.matchedText} numberOfLines={2}>{`You and ${person.name} matched`}</Text>
            <TouchableOpacity onPress={() => onOpenChat(match.id)} style={styles.primarySmall} accessibilityRole="button">
              <Text style={styles.primaryText}>Open chat</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Synthetic chat ────────────────────────────────────────────────────────

function ChatView({
  match,
  insetsTop,
  insetsBottom,
  onBack,
  onSend,
}: {
  match: NewMatch;
  insetsTop: number;
  insetsBottom: number;
  onBack: () => void;
  onSend: (text: string) => void;
}) {
  const p = personOf(match.personId);
  const [draft, setDraft] = useState('');
  const started = conversationStarted(match);
  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insetsTop }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.subHeader}>
        <TouchableOpacity onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to Activity" style={styles.back}>
          <Ionicons name="chevron-back" size={26} color={obColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.subTitle} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.devPill}>DEV</Text>
      </View>
      <ScrollView contentContainerStyle={styles.chatContent} keyboardShouldPersistTaps="handled">
        {/* Context only — a like's comment is never shown as a message. */}
        {match.context.map((c, i) => (
          <View key={i} style={styles.chatContext}>
            <Text style={styles.contextWhat}>{c.fromMe ? `You liked ${p.name}’s ${c.target.kind === 'photo' ? 'photo' : 'answer'}` : `${p.name} ${likedWhat(c.target).replace('Liked', 'liked')}`}</Text>
            {c.fromMe ? null : <LikedContent target={c.target} comment={c.comment} />}
          </View>
        ))}
        {started ? (
          match.messages.map((m) => (
            <View key={m.id} style={[styles.bubble, m.fromMe ? styles.mine : styles.theirs]}>
              <Text style={[styles.bubbleText, m.fromMe && { color: obColors.onCta }]}>{m.text}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.chatHint}>{`Say hi to ${p.name}`}</Text>
        )}
      </ScrollView>
      <View style={[styles.inputRow, { paddingBottom: Math.max(insetsBottom, obSpacing.sm) }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
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
          disabled={!draft.trim()}
          style={[styles.send, !draft.trim() && { backgroundColor: obColors.ctaDisabled }]}
          accessibilityRole="button"
          accessibilityLabel="Send (preview only, nothing is sent)"
          accessibilityState={{ disabled: !draft.trim() }}>
          <Ionicons name="arrow-up" size={20} color={obColors.onCta} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function DevPanel({ onAction, onExit }: { onAction: (a: ActivityAction) => void; onExit: () => void }) {
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
        {btn('Reset', () => onAction({ type: 'reset' }))}
        {btn('Exit preview', onExit)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: obSpacing.sm,
    paddingHorizontal: obSpacing.lg + 4,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm, flexShrink: 1 },
  title: { fontFamily: obFonts.heading, fontSize: 30, lineHeight: 38, color: obColors.textPrimary },
  markAll: { minHeight: 44, justifyContent: 'center' },
  markAllText: { fontFamily: obFonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: obColors.cta },
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
  content: { paddingHorizontal: obSpacing.lg, paddingTop: obSpacing.sm, paddingBottom: obSpacing.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm, marginBottom: obSpacing.md },
  sectionTitle: { fontFamily: obFonts.heading, fontSize: 21, lineHeight: 28, color: obColors.textPrimary },
  sectionEmpty: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary },
  countPill: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 8, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: obFonts.bodySemiBold, fontSize: 13, lineHeight: 17, color: obColors.onCta },
  list: { gap: obSpacing.md },
  card: { backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: CARD_BORDER, padding: obSpacing.md, gap: obSpacing.md },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md },
  avatar: { width: 56, height: 70, borderRadius: 10, backgroundColor: obColors.notice },
  cardWho: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: obFonts.bodySemiBold, fontSize: 17, lineHeight: 22, color: obColors.textPrimary },
  meta: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: obColors.cta },
  context: { flexDirection: 'row', gap: obSpacing.md, padding: obSpacing.md, borderRadius: 12, backgroundColor: SAGE },
  contextThumb: { width: 52, height: 66, borderRadius: 8, backgroundColor: obColors.notice },
  contextPrompt: { flex: 1, minWidth: 0, gap: 2 },
  contextPromptLabel: { fontFamily: obFonts.bodyMedium, fontSize: 12, lineHeight: 16, color: obColors.textSecondary },
  contextPromptAnswer: { fontFamily: obFonts.heading, fontSize: 16, lineHeight: 22, color: obColors.textPrimary },
  contextText: { flex: 1, minWidth: 0, gap: 2 },
  contextWhat: { fontFamily: obFonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  comment: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textPrimary },
  noComment: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  secondary: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 12, borderWidth: 1, borderColor: obColors.cta },
  secondaryText: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.cta },
  matchList: { backgroundColor: SURFACE, borderRadius: 16, borderWidth: 1, borderColor: CARD_BORDER, paddingHorizontal: obSpacing.md },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md, paddingVertical: obSpacing.sm + 2 },
  matchAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: obColors.notice },
  openChat: { minHeight: 44, justifyContent: 'center', paddingHorizontal: obSpacing.md, borderRadius: 22, backgroundColor: SAGE },
  openChatText: { fontFamily: obFonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: obColors.cta },
  stateBody: { alignItems: 'center', gap: obSpacing.md, paddingHorizontal: obSpacing.lg, paddingVertical: obSpacing.xxl * 2 },
  stateTitle: { fontFamily: obFonts.heading, fontSize: 24, lineHeight: 31, color: obColors.textPrimary, textAlign: 'center' },
  stateText: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary, textAlign: 'center' },
  primary: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: obSpacing.xl, borderRadius: 14, backgroundColor: obColors.cta, alignSelf: 'stretch' },
  primarySmall: { minHeight: 44, justifyContent: 'center', paddingHorizontal: obSpacing.lg, borderRadius: 14, backgroundColor: obColors.cta },
  primaryText: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 21, color: obColors.onCta },
  subHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm, paddingHorizontal: obSpacing.md },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  subTitle: { flex: 1, fontFamily: obFonts.bodySemiBold, fontSize: 17, lineHeight: 22, color: obColors.textPrimary },
  profileContext: { marginHorizontal: obSpacing.md, marginBottom: obSpacing.md, gap: obSpacing.sm },
  contextHeading: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  footer: { paddingHorizontal: obSpacing.lg, paddingTop: obSpacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: CARD_BORDER, backgroundColor: obColors.background },
  matchedRow: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md },
  matchedText: { flex: 1, fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  chatContent: { padding: obSpacing.lg, gap: obSpacing.sm },
  chatContext: { gap: obSpacing.xs, marginBottom: obSpacing.sm },
  chatHint: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary, textAlign: 'center', marginTop: obSpacing.lg },
  bubble: { maxWidth: '80%', paddingHorizontal: obSpacing.md, paddingVertical: obSpacing.sm, borderRadius: 16 },
  mine: { alignSelf: 'flex-end', backgroundColor: obColors.cta },
  theirs: { alignSelf: 'flex-start', backgroundColor: SURFACE, borderWidth: 1, borderColor: CARD_BORDER },
  bubbleText: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textPrimary },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: obSpacing.sm, paddingHorizontal: obSpacing.md, paddingTop: obSpacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: CARD_BORDER },
  input: { flex: 1, minHeight: 44, maxHeight: 120, paddingHorizontal: obSpacing.md, paddingVertical: 10, borderRadius: 22, backgroundColor: SURFACE, borderWidth: 1, borderColor: CARD_BORDER, fontFamily: obFonts.body, fontSize: 16, color: obColors.textPrimary },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
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
