// DEV-only interactive preview of the approved V2 Matches design (3-screen
// mockup, 2026-10-08): "Picked for you" and "You both liked" as large photo
// cards, the full profile from the approved Discover layout (shared
// components), targeted likes + inline comments inside the profile, a local
// demo chat, and the "Conversation started" state.
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
  Pressable,
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
import { DISCOVER_PHOTOS } from '@/components/dev/discover/previewPhotos';
import { DiscoverProfileItems, type EditorState, type ItemHandlers } from '@/components/discover/DiscoverProfileItems';
import { useInlineEditorKeyboard } from '@/components/discover/useInlineEditorKeyboard';
import { buildDiscoverLayout, heroLocation } from '@/lib/discover/profileLayout';
import {
  COMMENT_MAX,
  INITIAL_PREVIEW_STATE,
  mutualStatus,
  personLabel,
  pickStatus,
  PREVIEW_COPY as C,
  PREVIEW_PEOPLE,
  previewReducer,
  type PreviewPersonKey,
  type PreviewScenario,
  type PreviewState,
} from '@/lib/dev/matchesPreview';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

const FADE = require('../../assets/images/discover-fade.png');
const SURFACE = '#FFFDF8';
const CARD_BORDER = '#E4DCCB';
const photosOf = (who: PreviewPersonKey) => DISCOVER_PHOTOS[PREVIEW_PEOPLE[who].id] ?? [];

type ViewState = { name: 'matches' } | { name: 'profile'; who: PreviewPersonKey } | { name: 'chat' };

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
        who={view.who}
        state={state}
        onBack={toMatches}
        onLike={(target, comment) => {
          dispatch({ type: 'send_like', target, comment });
          // A heart (no comment) returns to Matches, where the card shows
          // "Like sent". A comment keeps the profile open with the note in
          // place; Back returns to Matches.
          if (!comment.trim()) toMatches();
        }}
      />
    );
  }
  if (view.name === 'chat') {
    return <ChatPreview messages={state.mutual.messages} onBack={toMatches} onSend={(text) => dispatch({ type: 'send_message', text })} />;
  }
  return (
    <MatchesHome
      state={state}
      onExit={onExit}
      onOpenProfile={(who) => setView({ name: 'profile', who })}
      onSayHello={() => setView({ name: 'chat' })}
      onScenario={(s) => dispatch(s === 'reset' ? { type: 'reset' } : { type: 'scenario', scenario: s })}
    />
  );
}

// ─── Matches home ──────────────────────────────────────────────────────────

function MatchesHome({
  state,
  onExit,
  onOpenProfile,
  onSayHello,
  onScenario,
}: {
  state: PreviewState;
  onExit?: () => void;
  onOpenProfile: (who: PreviewPersonKey) => void;
  onSayHello: () => void;
  onScenario: (s: PreviewScenario | 'reset') => void;
}) {
  const insets = useSafeAreaInsets();
  const pick = pickStatus(state);
  const mutual = mutualStatus(state);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.homeContent}>
        <View style={styles.topRow}>
          <Text style={styles.screenTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>{C.title}</Text>
          {onExit ? (
            <TouchableOpacity onPress={onExit} hitSlop={10} accessibilityRole="button" accessibilityLabel="Exit Matches design preview">
              <Text style={styles.devPill}>DEV ✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.sectionTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>{C.pickedTitle}</Text>
        {pick === 'none' ? (
          <EmptyCard icon="sparkles-outline" title={C.noPickTitle} text={C.noPickText} />
        ) : (
          <PersonCard who="pick" onOpenProfile={() => onOpenProfile('pick')}>
            {pick === 'like_sent' ? (
              <View style={styles.likeSentRow} accessible accessibilityLabel={C.likeSent}>
                <Ionicons name="heart-outline" size={16} color={obColors.textSecondary} importantForAccessibility="no" />
                <Text style={styles.likeSentText}>{C.likeSent}</Text>
              </View>
            ) : null}
            <TouchableOpacity onPress={() => onOpenProfile('pick')} style={styles.outlineBtn} accessibilityRole="button" accessibilityLabel={`${C.viewProfile}, ${PREVIEW_PEOPLE.pick.name}`}>
              <Text style={styles.outlineBtnText}>{C.viewProfile}</Text>
            </TouchableOpacity>
          </PersonCard>
        )}

        <Text style={[styles.sectionTitle, styles.sectionGap]} accessibilityRole="header" maxFontSizeMultiplier={1.4}>{C.mutualTitle}</Text>
        {mutual === 'none' ? (
          <EmptyCard icon="heart-outline" title={C.noMutualTitle} text={C.noMutualText} />
        ) : (
          <PersonCard who="mutual" onOpenProfile={() => onOpenProfile('mutual')}>
            {mutual === 'conversation_started' ? (
              <View style={styles.started} accessible accessibilityLabel={`${C.conversationStarted}. ${C.conversationNote}`}>
                <View style={styles.startedIcon}>
                  <Ionicons name="checkmark" size={16} color={obColors.onCta} importantForAccessibility="no" />
                </View>
                <View style={styles.startedText}>
                  <Text style={styles.startedTitle}>{C.conversationStarted}</Text>
                  <Text style={styles.startedNote}>{C.conversationNote}</Text>
                </View>
              </View>
            ) : (
              <TouchableOpacity onPress={onSayHello} style={styles.fillBtn} accessibilityRole="button" accessibilityLabel={`${C.sayHello}, ${PREVIEW_PEOPLE.mutual.name}`}>
                <Text style={styles.fillBtnText}>{C.sayHello}</Text>
              </TouchableOpacity>
            )}
          </PersonCard>
        )}

        <DevControls state={state} onScenario={onScenario} />
      </ScrollView>
      <PreviewTabBar bottomInset={insets.bottom} active="Matches" />
    </View>
  );
}

/** Large photo card: the photo opens the profile; actions sit below it.
 * Same size in every state (a started conversation doesn't shrink it). */
function PersonCard({ who, onOpenProfile, children }: { who: PreviewPersonKey; onOpenProfile: () => void; children: ReactNode }) {
  const p = PREVIEW_PEOPLE[who];
  const loc = heroLocation(p);
  return (
    <View style={styles.card}>
      <Pressable onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel={`${personLabel(p)}. Open profile`}>
        <Image source={photosOf(who)[0]} style={styles.cardPhoto} contentFit="cover" contentPosition="top" accessible={false} />
        <Image source={FADE} style={styles.fade} contentFit="fill" accessible={false} />
        <View style={styles.cardNameWrap} pointerEvents="none">
          <Text style={styles.cardName} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {p.name}
            {p.age !== null ? <Text style={styles.cardAge}>, {p.age}</Text> : null}
          </Text>
          {loc ? (
            <View style={styles.cardLoc}>
              <Ionicons name="location-outline" size={15} color="#FFFFFF" importantForAccessibility="no" />
              <Text style={styles.cardLocText} numberOfLines={1}>{loc}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.cardBody}>{children}</View>
    </View>
  );
}

function EmptyCard({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={28} color={obColors.cta} importantForAccessibility="no" />
      <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.4}>{title}</Text>
      <Text style={styles.emptyText} maxFontSizeMultiplier={1.6}>{text}</Text>
    </View>
  );
}

function DevControls({ state, onScenario }: { state: PreviewState; onScenario: (s: PreviewScenario | 'reset') => void }) {
  const btn = (label: string, s: PreviewScenario | 'reset') => (
    <TouchableOpacity key={s} onPress={() => onScenario(s)} style={styles.devBtn} accessibilityRole="button" accessibilityLabel={`Preview state: ${label}`}>
      <Text style={styles.devBtnText} maxFontSizeMultiplier={1.4}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.dev}>
      <Text style={styles.devTitle}>Preview controls · DEV</Text>
      <Text style={styles.devText}>
        Local sample data only. The two people are fixed synthetic examples, not picked by any algorithm. Likes and the chat are a local demo: nothing is liked, sent or saved, and Reset doesn’t touch your account or Chats. Photos are illustrated placeholders.
      </Text>
      <Text style={styles.devText}>{`Now: pick ${pickStatus(state)} · mutual ${mutualStatus(state)}`}</Text>
      <View style={styles.devRow}>
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
  who,
  state,
  onBack,
  onLike,
}: {
  who: PreviewPersonKey;
  state: PreviewState;
  onBack: () => void;
  onLike: (target: string, comment: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const person = PREVIEW_PEOPLE[who];
  const items = useMemo(() => buildDiscoverLayout(person), [person]);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const kb = useInlineEditorKeyboard(editor?.target);
  const [frameHeight, setFrameHeight] = useState(0);
  const onFrameLayout = (e: LayoutChangeEvent) => {
    if (!kb.keyboardOpen && !editor) setFrameHeight(e.nativeEvent.layout.height);
  };

  // Only the "Picked for you" person can be liked here (one like per
  // person); the mutual person is already a match.
  const like = who === 'pick' ? state.pick.like : null;
  const canLike = who === 'pick' && !like;
  const typing = kb.keyboardOpen && !!editor;

  const h: ItemHandlers = {
    person,
    photoSource: (i) => photosOf(who)[i] ?? null,
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

function ChatPreview({ messages, onBack, onSend }: { messages: { id: string; text: string }[]; onBack: () => void; onSend: (text: string) => void }) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const p = PREVIEW_PEOPLE.mutual;
  const started = messages.length > 0;
  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Back to Matches">
          <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.chatWho}>
          <Image source={photosOf('mutual')[0]} style={styles.chatAvatar} contentFit="cover" accessible={false} />
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
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 52, marginBottom: obSpacing.sm },
  screenTitle: { flexShrink: 1, fontFamily: obFonts.heading, fontSize: 32, lineHeight: 40, color: obColors.textPrimary },
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
  sectionTitle: { fontFamily: obFonts.heading, fontSize: 20, lineHeight: 26, color: obColors.textPrimary, marginBottom: obSpacing.sm },
  sectionGap: { marginTop: obSpacing.xl },
  card: { backgroundColor: SURFACE, borderRadius: 18, borderWidth: 1, borderColor: CARD_BORDER, overflow: 'hidden' },
  // Large, nearly square photo (mockup); not shrunk to fit both cards.
  cardPhoto: { width: '100%', aspectRatio: 1, backgroundColor: obColors.selectedFill },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  cardNameWrap: { position: 'absolute', left: obSpacing.lg, right: obSpacing.lg, bottom: obSpacing.md, gap: 2 },
  cardName: {
    fontFamily: obFonts.heading,
    fontSize: 27,
    lineHeight: 34,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardAge: { fontFamily: obFonts.heading, color: '#FFFFFF' },
  cardLoc: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardLocText: { flexShrink: 1, fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: '#FFFFFF' },
  cardBody: { padding: obSpacing.sm + 2, gap: obSpacing.sm },
  outlineBtn: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: obColors.border, backgroundColor: SURFACE, alignItems: 'center', justifyContent: 'center' },
  outlineBtnText: { fontFamily: obFonts.bodyMedium, fontSize: 16, lineHeight: 21, color: obColors.textPrimary },
  fillBtn: { minHeight: 46, borderRadius: 12, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
  fillBtnText: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 21, color: obColors.onCta },
  likeSentRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: obSpacing.xs },
  likeSentText: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  started: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md, borderRadius: 12, backgroundColor: obColors.selectedFill, paddingHorizontal: obSpacing.md, paddingVertical: obSpacing.sm + 2 },
  startedIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
  startedText: { flex: 1, gap: 1 },
  startedTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
  startedNote: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  empty: { alignItems: 'center', gap: obSpacing.sm, backgroundColor: SURFACE, borderRadius: 18, borderWidth: 1, borderColor: CARD_BORDER, paddingVertical: obSpacing.xxl, paddingHorizontal: obSpacing.xl },
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
