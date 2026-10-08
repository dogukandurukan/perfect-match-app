// DEV-only interactive preview of the approved V2 Matches design (3-screen
// mockup, 2026-10-08): "Picked for you" and "You both liked" as large photo
// cards, the full profile from the approved Discover layout (shared
// components), targeted likes + inline comments inside the profile, a local
// demo chat, and the "Conversation started" state. Daily picks (D61–D66)
// are SIMULATED: a period changes only with the DEV refresh button.
// Local fixtures only: no Supabase import — nothing is liked, sent, matched
// or reset on a real account. The real Matches tab is untouched.
// Opened from app/dev/matches-preview.tsx (redirects in production).
// Photos are illustrated "DEV · SYNTHETIC" placeholders, not final imagery.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PreviewTabBar } from '@/components/dev/discover/PreviewTabBar';
import {
  EmptyCard,
  MatchesTitle,
  PersonCard as SharedPersonCard,
  SayHelloButton,
  SectionHead,
  StartedBox,
  StatusLine,
  ViewProfileButton,
} from '@/components/matches/v2/DailyMatchCards';
import { DISCOVER_PHOTOS } from '@/components/dev/discover/previewPhotos';
import { DiscoverProfileItems, type EditorState, type ItemHandlers } from '@/components/discover/DiscoverProfileItems';
import { useInlineEditorKeyboard } from '@/components/discover/useInlineEditorKeyboard';
import { buildDiscoverLayout, heroLocation } from '@/lib/discover/profileLayout';
import {
  COMMENT_MAX,
  INITIAL_PREVIEW_STATE,
  isMatched,
  mutualStatus,
  personLabel,
  pickStatus,
  PREVIEW_COPY as C,
  previewPerson,
  previewReducer,
  type PreviewScenario,
  type PreviewState,
} from '@/lib/dev/matchesPreview';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

const SURFACE = '#FFFDF8';
const CARD_BORDER = '#E4DCCB';
const photosOf = (id: string) => DISCOVER_PHOTOS[id] ?? [];

type ViewState = { name: 'matches' } | { name: 'profile'; id: string } | { name: 'chat'; id: string };

type DevAction = PreviewScenario | 'reset' | 'refresh' | 'they_like_back';

export function MatchesDesignPreview({ onExit }: { onExit?: () => void }) {
  const [state, dispatch] = useReducer(previewReducer, INITIAL_PREVIEW_STATE);
  const [view, setView] = useState<ViewState>({ name: 'matches' });

  // Android back steps inside the preview before leaving it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (view.name !== 'matches') {
        setView({ name: 'matches' });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [view]);

  const toMatches = () => setView({ name: 'matches' });

  if (view.name === 'profile') {
    return (
      <ProfileView
        id={view.id}
        state={state}
        onBack={toMatches}
        onLike={(target, comment) => {
          dispatch({ type: 'send_like', personId: view.id, target, comment });
          // A heart (no comment) returns to Matches, where the card shows
          // "Like sent". A comment keeps the profile open with the note in
          // place; Back returns to Matches.
          if (!comment.trim()) toMatches();
        }}
      />
    );
  }
  if (view.name === 'chat') {
    const id = view.id;
    return <ChatPreview id={id} messages={state.messages[id] ?? []} onBack={toMatches} onSend={(text) => dispatch({ type: 'send_message', personId: id, text })} />;
  }
  return (
    <MatchesHome
      state={state}
      onExit={onExit}
      onOpenProfile={(id) => setView({ name: 'profile', id })}
      onSayHello={(id) => setView({ name: 'chat', id })}
      onDev={(a) =>
        dispatch(a === 'reset' || a === 'refresh' || a === 'they_like_back' ? { type: a } : { type: 'scenario', scenario: a })
      }
    />
  );
}

// ─── Matches home ──────────────────────────────────────────────────────────

function MatchesHome({
  state,
  onExit,
  onOpenProfile,
  onSayHello,
  onDev,
}: {
  state: PreviewState;
  onExit?: () => void;
  onOpenProfile: (id: string) => void;
  onSayHello: (id: string) => void;
  onDev: (a: DevAction) => void;
}) {
  const insets = useSafeAreaInsets();
  const pick = pickStatus(state);
  const mutual = mutualStatus(state);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.homeContent}>
        <MatchesTitle
          right={
            onExit ? (
              <TouchableOpacity onPress={onExit} hitSlop={10} accessibilityRole="button" accessibilityLabel="Exit Matches design preview">
                <Text style={styles.devPill}>DEV ✕</Text>
              </TouchableOpacity>
            ) : null
          }
        />

        <SectionHead title={C.pickedTitle} caption={C.pickedCaption} />
        {pick === 'none' || !state.pickId ? (
          <EmptyCard icon="sparkles-outline" title={C.noPickTitle} text={C.noPickText} />
        ) : (
          <PersonCard id={state.pickId} onOpenProfile={() => onOpenProfile(state.pickId as string)}>
            {pick === 'conversation_started' ? (
              <StartedBox />
            ) : pick === 'matched' ? (
              // Liked back during the period: the same card shows the new
              // state — no second copy in "You both liked".
              <>
                <StatusLine text={C.likedBack} />
                <SayHelloButton name={previewPerson(state.pickId).name} onPress={() => onSayHello(state.pickId as string)} />
              </>
            ) : (
              <>
                {pick === 'like_sent' ? <StatusLine text={C.likeSent} /> : null}
                <ViewProfileButton name={previewPerson(state.pickId).name} onPress={() => onOpenProfile(state.pickId as string)} />
              </>
            )}
          </PersonCard>
        )}

        <SectionHead title={C.mutualTitle} caption={C.mutualCaption} gapAbove />
        {mutual === 'none' || mutual === 'none_today' || !state.mutualId ? (
          mutual === 'none_today' ? (
            <EmptyCard icon="chatbubbles-outline" title={C.noMutualTodayTitle} text={C.noMutualTodayText} />
          ) : (
            <EmptyCard icon="heart-outline" title={C.noMutualTitle} text={C.noMutualText} />
          )
        ) : (
          <PersonCard id={state.mutualId} onOpenProfile={() => onOpenProfile(state.mutualId as string)}>
            {mutual === 'conversation_started' ? (
              <StartedBox />
            ) : (
              <SayHelloButton name={previewPerson(state.mutualId).name} onPress={() => onSayHello(state.mutualId as string)} />
            )}
          </PersonCard>
        )}

        <DevControls state={state} onDev={onDev} />
      </ScrollView>
      <PreviewTabBar bottomInset={insets.bottom} active="Matches" />
    </View>
  );
}

/** Preview fixture → the shared approved card. */
function PersonCard({ id, onOpenProfile, children }: { id: string; onOpenProfile: () => void; children: ReactNode }) {
  const p = previewPerson(id);
  return (
    <SharedPersonCard name={p.name} age={p.age} location={heroLocation(p)} photo={photosOf(id)[0] ?? null} onOpenProfile={onOpenProfile}>
      {children}
    </SharedPersonCard>
  );
}

function DevControls({ state, onDev }: { state: PreviewState; onDev: (a: DevAction) => void }) {
  const btn = (label: string, a: DevAction) => (
    <TouchableOpacity key={a} onPress={() => onDev(a)} style={styles.devBtn} accessibilityRole="button" accessibilityLabel={`Preview: ${label}`}>
      <Text style={styles.devBtnText} maxFontSizeMultiplier={1.4}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.dev}>
      <Text style={styles.devTitle}>Preview controls · DEV</Text>
      <Text style={styles.devText}>
        Local sample data only. Daily picks are SIMULATED: a new period starts only when you press “Simulate 12:00 refresh” — no timer, no clock and no selection algorithm runs. The people are fixed synthetic examples, not chosen by scoring. Likes and the chat are a local demo: nothing is liked, sent or saved, and Reset doesn’t touch your account or Chats. Photos are illustrated placeholders.
      </Text>
      <Text style={styles.devText}>{`Period ${state.period} · pick ${pickStatus(state)} · mutual ${mutualStatus(state)}`}</Text>
      <View style={styles.devRow}>
        {btn('Simulate 12:00 refresh', 'refresh')}
        {btn('They like you back', 'they_like_back')}
        {btn('Both cards', 'both')}
        {btn('No mutual like', 'no_mutual')}
        {btn('No new pick', 'no_pick')}
        {btn('Like sent', 'like_sent')}
        {btn('Conversation started', 'conversation_started')}
        {btn('Reset', 'reset')}
      </View>
    </View>
  );
}

// ─── Profile (approved Discover layout, shared components) ────────────────

function ProfileView({
  id,
  state,
  onBack,
  onLike,
}: {
  id: string;
  state: PreviewState;
  onBack: () => void;
  onLike: (target: string, comment: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const person = useMemo(() => previewPerson(id), [id]);
  const items = useMemo(() => buildDiscoverLayout(person), [person]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const kb = useInlineEditorKeyboard(editor?.target);
  const [frameHeight, setFrameHeight] = useState(0);
  const onFrameLayout = (e: LayoutChangeEvent) => {
    if (!kb.keyboardOpen && !editor) setFrameHeight(e.nativeEvent.layout.height);
  };

  // Only the featured pick can be liked here (one like per person); a match
  // is already mutual.
  const like = state.likes[id] ?? null;
  const canLike = id === state.pickId && !like && !isMatched(state, id);
  const typing = kb.keyboardOpen && !!editor;

  const h: ItemHandlers = {
    person,
    photoSource: (i) => photosOf(id)[i] ?? null,
    heroHeight: Math.max(frameHeight, 360),
    editor,
    canLike,
    liked: !!like,
    sent: like && like.comment ? { target: like.target, comment: like.comment } : null,
    onLike: (target) => onLike(target, ''),
    onOpenComment: (target) => {
      if (!canLike) return;
      setEditor((e) => (e && e.target === target ? e : { target, draft: '' }));
    },
    onEditComment: (text) => setEditor((e) => (e ? { ...e, draft: text.slice(0, COMMENT_MAX) } : e)),
    onCancelComment: () => {
      kb.closeKeyboard();
      setEditor(null);
    },
    onSendComment: () => {
      if (!editor || !editor.draft.trim()) return;
      kb.closeKeyboard();
      const { target, draft } = editor;
      setEditor(null);
      onLike(target, draft);
    },
    onEditorResize: kb.onEditorResize,
    editorRef: kb.setEditorRef,
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Back to Matches">
          <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.4}>{person.name}</Text>
        <View style={styles.iconBtn} />
      </View>
      <View ref={kb.frameRef} style={styles.frame} onLayout={onFrameLayout} collapsable={false}>
        <ScrollView
          ref={kb.scrollRef}
          onScroll={(e) => kb.onScroll(e.nativeEvent.contentOffset.y)}
          scrollEventThrottle={32}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ paddingBottom: obSpacing.xl }}>
          <DiscoverProfileItems items={items} h={h} />
        </ScrollView>
      </View>
      {!typing ? <PreviewTabBar bottomInset={insets.bottom} active="Matches" /> : null}
    </View>
  );
}

// ─── Local demo chat (nothing is sent) ─────────────────────────────────────

function ChatPreview({ id, messages, onBack, onSend }: { id: string; messages: { id: string; text: string }[]; onBack: () => void; onSend: (text: string) => void }) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const p = previewPerson(id);
  const started = messages.length > 0;
  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Back to Matches">
          <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.chatWho}>
          <Image source={photosOf(id)[0]} style={styles.chatAvatar} contentFit="cover" accessible={false} />
          <Text style={styles.headerTitle} numberOfLines={1}>{p.name}</Text>
        </View>
        <View style={styles.iconBtn} />
      </View>
      <Text style={styles.chatBanner}>DEV demo chat · nothing is sent to Chats</Text>
      <ScrollView contentContainerStyle={styles.chatBody} keyboardShouldPersistTaps="handled">
        {started ? (
          <>
            {messages.map((m) => (
              <View key={m.id} style={styles.bubble}>
                <Text style={styles.bubbleText}>{m.text}</Text>
              </View>
            ))}
            <Text style={styles.chatNote} accessibilityLiveRegion="polite">{C.chatAfterFirst}</Text>
          </>
        ) : (
          <View style={styles.chatEmpty}>
            <Text style={styles.emptyTitle}>{C.chatEmptyTitle(p.name)}</Text>
            <Text style={styles.emptyText}>{C.chatEmptyText}</Text>
          </View>
        )}
      </ScrollView>
      {!started ? (
        <View style={[styles.inputRow, { paddingBottom: Math.max(insets.bottom, 20) + obSpacing.xs }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={C.chatPlaceholder}
            placeholderTextColor={obColors.textSecondary}
            style={styles.chatInput}
            multiline
            accessibilityLabel="Message"
          />
          <TouchableOpacity
            onPress={() => {
              onSend(text);
              setText('');
            }}
            disabled={!text.trim()}
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Send"
            accessibilityState={{ disabled: !text.trim() }}>
            <Ionicons name="arrow-up" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  homeContent: { paddingHorizontal: obSpacing.lg + 4, paddingBottom: obSpacing.xl },
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
  emptyTitle: { fontFamily: obFonts.heading, fontSize: 20, lineHeight: 27, color: obColors.textPrimary, textAlign: 'center' },
  emptyText: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary, textAlign: 'center' },
  dev: { marginTop: obSpacing.xxl, gap: obSpacing.sm, padding: obSpacing.md, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: obColors.border, backgroundColor: obColors.notice },
  devTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: obColors.textPrimary },
  devText: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  devRow: { flexDirection: 'row', flexWrap: 'wrap', gap: obSpacing.sm },
  devBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: obSpacing.md, borderRadius: 10, borderWidth: 1, borderColor: obColors.border, backgroundColor: SURFACE },
  devBtnText: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: obSpacing.sm, minHeight: 48 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flexShrink: 1, fontFamily: obFonts.heading, fontSize: 20, lineHeight: 26, color: obColors.textPrimary },
  frame: { flex: 1 },
  chatWho: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm, flexShrink: 1 },
  chatAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: obColors.selectedFill },
  chatBanner: {
    alignSelf: 'center',
    fontFamily: obFonts.bodyMedium,
    fontSize: 12,
    lineHeight: 16,
    color: '#8A5A00',
    backgroundColor: '#F3E4C4',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  chatBody: { flexGrow: 1, padding: obSpacing.gutter, gap: obSpacing.md },
  chatEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: obSpacing.sm, paddingVertical: 48 },
  bubble: { alignSelf: 'flex-end', maxWidth: '80%', backgroundColor: obColors.cta, borderRadius: 18, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: '#FFFFFF' },
  chatNote: { alignSelf: 'center', fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary, textAlign: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: obSpacing.sm, paddingHorizontal: obSpacing.lg, paddingTop: obSpacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: CARD_BORDER },
  chatInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: obColors.border,
    backgroundColor: SURFACE,
    paddingHorizontal: 14,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: obFonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: obColors.textPrimary,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { backgroundColor: obColors.ctaDisabled },
});
