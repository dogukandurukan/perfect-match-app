// DEV-only interactive preview of the proposed V2 Matches design (large photo
// cards: "Picked for you" + "You both liked"). Local fixtures only: no
// Supabase import, nothing is liked, sent, matched or reset on a real account.
// Opened from app/dev/matches-preview.tsx (redirects in production).
// Photos are bundled illustrated placeholders ("DEV · SYNTHETIC"), not final
// imagery — realistic, licence-clear portraits are still missing.
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  BackHandler,
  Image as RNImage,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProfilePreview, type ProfileLikeTarget } from '@/components/onboarding-v2/yourProfile/ProfilePreview';
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
} from '@/lib/dev/matchesPreview';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { buildPublicProfileBlocks } from '@/lib/onboardingV2/yourProfile';

const PHOTOS: Record<PreviewPersonKey, number[]> = {
  pick: [
    require('../../assets/dev/matches-preview/defne-1.png'),
    require('../../assets/dev/matches-preview/defne-2.png'),
    require('../../assets/dev/matches-preview/defne-3.png'),
  ],
  mutual: [
    require('../../assets/dev/matches-preview/ipek-1.png'),
    require('../../assets/dev/matches-preview/ipek-2.png'),
    require('../../assets/dev/matches-preview/ipek-3.png'),
  ],
};

const SURFACE = '#FFFDF8';
const CARD_BORDER = '#E4DCCB';

type View_ = { name: 'matches' } | { name: 'profile'; who: PreviewPersonKey } | { name: 'chat' };

export function MatchesDesignPreview({ onExit }: { onExit?: () => void }) {
  const [state, dispatch] = useReducer(previewReducer, INITIAL_PREVIEW_STATE);
  const [view, setView] = useState<View_>({ name: 'matches' });
  const [likeTarget, setLikeTarget] = useState<ProfileLikeTarget | null>(null);

  // Android back steps inside the preview before leaving it.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (likeTarget) {
        setLikeTarget(null);
        return true;
      }
      if (view.name !== 'matches') {
        setView({ name: 'matches' });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [likeTarget, view]);

  const blocks = useMemo(() => {
    const make = (key: PreviewPersonKey) =>
      buildPublicProfileBlocks({
        ...PREVIEW_PEOPLE[key],
        photos: PHOTOS[key].map((m, i) => ({ id: `${key}-${i}`, uri: RNImage.resolveAssetSource(m).uri })),
      });
    return { pick: make('pick'), mutual: make('mutual') };
  }, []);

  const applyScenario = (s: PreviewScenario | 'reset') => {
    setLikeTarget(null);
    setView({ name: 'matches' });
    dispatch(s === 'reset' ? { type: 'reset' } : { type: 'scenario', scenario: s });
  };

  if (view.name === 'profile') {
    const who = view.who;
    const canLike = who === 'pick' && pickStatus(state) === 'new';
    return (
      <>
        <ProfileScreen
          who={who}
          blocks={blocks[who]}
          onBack={() => setView({ name: 'matches' })}
          onLike={canLike ? setLikeTarget : undefined}
          likeSent={who === 'pick' && pickStatus(state) === 'like_sent'}
          onSayHello={who === 'mutual' && mutualStatus(state) === 'new' ? () => setView({ name: 'chat' }) : undefined}
        />
        <LikeSheet
          target={likeTarget}
          name={PREVIEW_PEOPLE.pick.name}
          onCancel={() => setLikeTarget(null)}
          onSend={(comment) => {
            if (!likeTarget) return;
            dispatch({
              type: 'send_like',
              comment,
              target:
                likeTarget.kind === 'photo'
                  ? { kind: 'photo', photoIndex: likeTarget.photoIndex }
                  : { kind: 'prompt', label: likeTarget.label, answer: likeTarget.answer },
            });
            setLikeTarget(null);
            setView({ name: 'matches' });
          }}
        />
      </>
    );
  }

  if (view.name === 'chat') {
    return (
      <ChatPreview
        messages={state.mutual.messages}
        onBack={() => setView({ name: 'matches' })}
        onSend={(text) => dispatch({ type: 'send_message', text })}
      />
    );
  }

  return (
    <MatchesHome
      state={state}
      onExit={onExit}
      onOpenProfile={(who) => setView({ name: 'profile', who })}
      onSayHello={() => setView({ name: 'chat' })}
      onScenario={applyScenario}
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
  state: typeof INITIAL_PREVIEW_STATE;
  onExit?: () => void;
  onOpenProfile: (who: PreviewPersonKey) => void;
  onSayHello: () => void;
  onScenario: (s: PreviewScenario | 'reset') => void;
}) {
  const insets = useSafeAreaInsets();
  const pick = pickStatus(state);
  const mutual = mutualStatus(state);
  const comment = state.pick.like?.comment ?? '';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.homeContent, { paddingTop: insets.top + obSpacing.sm, paddingBottom: insets.bottom + obSpacing.xxl }]}>
      <View style={styles.topRow}>
        <Text style={styles.devPill} accessibilityLabel="Developer preview">DEV PREVIEW</Text>
        {onExit ? (
          <TouchableOpacity onPress={onExit} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Close preview">
            <Ionicons name="close" size={24} color={obColors.textPrimary} />
          </TouchableOpacity>
        ) : null}
      </View>
      <Text style={styles.screenTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>{C.title}</Text>

      <Text style={styles.sectionTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>{C.pickedTitle}</Text>
      {pick === 'none' ? (
        <EmptyCard icon="sparkles-outline" title={C.noPickTitle} text={C.noPickText} />
      ) : (
        <PersonCard
          who="pick"
          onPhotoPress={() => onOpenProfile('pick')}
          status={pick === 'like_sent' ? { icon: 'heart', text: C.likeSent } : null}
          note={pick === 'like_sent' ? (comment ? C.commentSentNote : C.likeSentNote) : null}
          action={{ label: C.viewProfile, onPress: () => onOpenProfile('pick'), variant: pick === 'like_sent' ? 'outline' : 'fill' }}
        />
      )}

      <Text style={[styles.sectionTitle, styles.sectionGap]} accessibilityRole="header" maxFontSizeMultiplier={1.4}>{C.mutualTitle}</Text>
      {mutual === 'none' ? (
        <EmptyCard icon="heart-outline" title={C.noMutualTitle} text={C.noMutualText} />
      ) : (
        <PersonCard
          who="mutual"
          onPhotoPress={() => onOpenProfile('mutual')}
          status={mutual === 'conversation_started' ? { icon: 'chatbubbles-outline', text: C.conversationStarted } : null}
          note={mutual === 'conversation_started' ? C.conversationNote : null}
          action={mutual === 'new' ? { label: C.sayHello, onPress: onSayHello, variant: 'fill' } : null}
        />
      )}

      <DevControls state={state} onScenario={onScenario} />
    </ScrollView>
  );
}

function PersonCard({
  who,
  onPhotoPress,
  status,
  note,
  action,
}: {
  who: PreviewPersonKey;
  onPhotoPress: () => void;
  status: { icon: keyof typeof Ionicons.glyphMap; text: string } | null;
  note: string | null;
  action: { label: string; onPress: () => void; variant: 'fill' | 'outline' } | null;
}) {
  const p = PREVIEW_PEOPLE[who];
  return (
    <View style={styles.card}>
      <Pressable onPress={onPhotoPress} accessibilityRole="button" accessibilityLabel={`${personLabel(p)}. Open profile`}>
        <Image source={PHOTOS[who][0]} style={styles.cardPhoto} contentFit="cover" accessible={false} />
        <Fade />
        <View style={styles.cardNameWrap} pointerEvents="none">
          <Text style={styles.cardName} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {p.name}
            {p.age !== null ? <Text style={styles.cardAge}>, {p.age}</Text> : null}
          </Text>
          {p.city ? (
            <Text style={styles.cardCity} numberOfLines={1} maxFontSizeMultiplier={1.4}>{p.city}</Text>
          ) : null}
        </View>
      </Pressable>
      {status || note || action ? (
        <View style={styles.cardBody}>
          {status ? (
            <View style={styles.statusChip} accessibilityRole="text">
              <Ionicons name={status.icon} size={16} color={obColors.cta} importantForAccessibility="no" />
              <Text style={styles.statusText} maxFontSizeMultiplier={1.6}>{status.text}</Text>
            </View>
          ) : null}
          {note ? <Text style={styles.note} maxFontSizeMultiplier={1.6}>{note}</Text> : null}
          {action ? (
            <TouchableOpacity
              onPress={action.onPress}
              style={[styles.button, action.variant === 'outline' && styles.buttonOutline]}
              accessibilityRole="button"
              accessibilityLabel={`${action.label}, ${p.name}`}>
              <Text style={[styles.buttonText, action.variant === 'outline' && styles.buttonTextOutline]} maxFontSizeMultiplier={1.4}>
                {action.label}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
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

// Same stacked-band fade as the profile hero (no gradient native module).
function Fade() {
  return (
    <View pointerEvents="none" style={styles.fade}>
      {Array.from({ length: 14 }).map((_, i) => {
        const t = (i + 1) / 14;
        return <View key={i} style={{ flex: 1, backgroundColor: `rgba(0,0,0,${(0.6 * t * t).toFixed(3)})` }} />;
      })}
    </View>
  );
}

function DevControls({ state, onScenario }: { state: typeof INITIAL_PREVIEW_STATE; onScenario: (s: PreviewScenario | 'reset') => void }) {
  const btn = (label: string, s: PreviewScenario | 'reset') => (
    <TouchableOpacity key={s} onPress={() => onScenario(s)} style={styles.devBtn} accessibilityRole="button" accessibilityLabel={`Preview state: ${label}`}>
      <Text style={styles.devBtnText} maxFontSizeMultiplier={1.4}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.dev}>
      <Text style={styles.devTitle}>Preview controls · DEV</Text>
      <Text style={styles.devText}>
        Local sample data only. Nothing is liked, sent or saved, and reset does not touch your account. Photos are illustrated placeholders, not final images.
      </Text>
      <Text style={styles.devText}>{`Now: pick ${pickStatus(state)} · mutual ${mutualStatus(state)}`}</Text>
      <View style={styles.devRow}>
        {btn('Both cards', 'both')}
        {btn('No mutual like', 'no_mutual')}
        {btn('No new pick', 'no_pick')}
        {btn('Reset', 'reset')}
      </View>
    </View>
  );
}

// ─── Profile (shared V2 profile component, local blocks) ───────────────────

function ProfileScreen({
  who,
  blocks,
  onBack,
  onLike,
  likeSent,
  onSayHello,
}: {
  who: PreviewPersonKey;
  blocks: ReturnType<typeof buildPublicProfileBlocks>;
  onBack: () => void;
  onLike?: (t: ProfileLikeTarget) => void;
  likeSent: boolean;
  onSayHello?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Back to Matches">
          <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>Profile</Text>
        <View style={styles.iconBtn} />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: obSpacing.gutter, paddingTop: obSpacing.sm, paddingBottom: insets.bottom + 96, gap: obSpacing.md }}>
        {likeSent ? (
          <View style={styles.statusChip}>
            <Ionicons name="heart" size={16} color={obColors.cta} importantForAccessibility="no" />
            <Text style={styles.statusText}>{C.likeSent}</Text>
          </View>
        ) : null}
        {onLike ? (
          <Text style={styles.hint} maxFontSizeMultiplier={1.6}>Tap a heart to like a photo or an answer.</Text>
        ) : null}
        <ProfilePreview blocks={blocks} onLike={onLike} />
      </ScrollView>
      {onSayHello ? (
        <View style={[styles.stickyFooter, { paddingBottom: insets.bottom + obSpacing.md }]}>
          <TouchableOpacity onPress={onSayHello} style={styles.button} accessibilityRole="button" accessibilityLabel={`${C.sayHello}, ${PREVIEW_PEOPLE[who].name}`}>
            <Text style={styles.buttonText}>{C.sayHello}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

function LikeSheet({
  target,
  name,
  onCancel,
  onSend,
}: {
  target: ProfileLikeTarget | null;
  name: string;
  onCancel: () => void;
  onSend: (comment: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [comment, setComment] = useState('');
  useEffect(() => {
    if (target) setComment('');
  }, [target]);
  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onCancel}>
      <KeyboardAvoidingView style={styles.sheetRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onCancel} accessibilityRole="button" accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + obSpacing.lg }]}>
          <Text style={styles.sheetTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            {target?.kind === 'prompt' ? `Like ${name}’s answer` : `Like ${name}’s photo`}
          </Text>
          {target?.kind === 'photo' ? (
            <Image source={{ uri: target.uri }} style={styles.sheetPhoto} contentFit="cover" accessibilityLabel={`Selected photo ${target.photoIndex + 1}`} />
          ) : target?.kind === 'prompt' ? (
            <View style={styles.sheetPrompt}>
              <Text style={styles.sheetPromptLabel}>{target.label}</Text>
              <Text style={styles.sheetPromptAnswer}>{target.answer}</Text>
            </View>
          ) : null}
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder={C.addComment}
            placeholderTextColor={obColors.textSecondary}
            style={styles.commentInput}
            multiline
            maxLength={COMMENT_MAX}
            accessibilityLabel={C.addComment}
          />
          <Text style={styles.counter}>{`${comment.length}/${COMMENT_MAX}`}</Text>
          <TouchableOpacity onPress={() => onSend(comment)} style={styles.button} accessibilityRole="button" accessibilityLabel={C.sendLike}>
            <Text style={styles.buttonText}>{C.sendLike}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancel} style={styles.cancel} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Local chat preview (nothing is sent) ──────────────────────────────────

function ChatPreview({
  messages,
  onBack,
  onSend,
}: {
  messages: { id: string; text: string }[];
  onBack: () => void;
  onSend: (text: string) => void;
}) {
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
          <Image source={PHOTOS.mutual[0]} style={styles.chatAvatar} contentFit="cover" accessible={false} />
          <Text style={styles.headerTitle} numberOfLines={1}>{p.name}</Text>
        </View>
        <View style={styles.iconBtn} />
      </View>
      <Text style={styles.chatBanner}>Preview · messages are not sent</Text>
      <ScrollView contentContainerStyle={styles.chatBody}>
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
        <View style={[styles.inputRow, { paddingBottom: insets.bottom + obSpacing.sm }]}>
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
  homeContent: { paddingHorizontal: obSpacing.gutter },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 },
  devPill: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.6,
    color: '#8A5A00',
    backgroundColor: '#F3E4C4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  screenTitle: { fontFamily: obFonts.heading, fontSize: 34, lineHeight: 42, color: obColors.textPrimary, marginBottom: obSpacing.lg },
  sectionTitle: { fontFamily: obFonts.heading, fontSize: 22, lineHeight: 29, color: obColors.textPrimary, marginBottom: obSpacing.md },
  sectionGap: { marginTop: obSpacing.xxl },
  card: { backgroundColor: SURFACE, borderRadius: 20, borderWidth: 1, borderColor: CARD_BORDER, overflow: 'hidden' },
  cardPhoto: { width: '100%', aspectRatio: 4 / 5, backgroundColor: obColors.selectedFill },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '40%' },
  cardNameWrap: { position: 'absolute', left: obSpacing.lg, right: obSpacing.lg, bottom: obSpacing.lg, gap: 2 },
  cardName: {
    fontFamily: obFonts.heading,
    fontSize: 30,
    lineHeight: 37,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  cardAge: { fontFamily: obFonts.body, color: '#FFFFFF' },
  cardCity: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: '#FFFFFF' },
  cardBody: { padding: obSpacing.lg, gap: obSpacing.md },
  statusChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: obColors.selectedFill,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusText: { fontFamily: obFonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: obColors.cta },
  note: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary },
  button: { minHeight: 50, borderRadius: 14, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center', paddingHorizontal: obSpacing.lg },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: obColors.cta },
  buttonText: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.onCta },
  buttonTextOutline: { color: obColors.cta },
  empty: {
    alignItems: 'center',
    gap: obSpacing.sm,
    backgroundColor: SURFACE,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingVertical: obSpacing.xxl,
    paddingHorizontal: obSpacing.xl,
  },
  emptyTitle: { fontFamily: obFonts.heading, fontSize: 20, lineHeight: 27, color: obColors.textPrimary, textAlign: 'center' },
  emptyText: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary, textAlign: 'center' },
  dev: {
    marginTop: obSpacing.xxl,
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: obSpacing.lg, minHeight: 48 },
  headerTitle: { fontFamily: obFonts.heading, fontSize: 22, lineHeight: 28, color: obColors.textPrimary },
  hint: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary },
  stickyFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: obSpacing.gutter,
    paddingTop: obSpacing.md,
    backgroundColor: obColors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CARD_BORDER,
  },
  sheetRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,27,24,0.4)' },
  sheet: { backgroundColor: obColors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: obSpacing.gutter, gap: obSpacing.md },
  sheetTitle: { fontFamily: obFonts.heading, fontSize: 22, lineHeight: 29, color: obColors.textPrimary },
  sheetPhoto: { width: 112, height: 140, borderRadius: 14, backgroundColor: obColors.selectedFill },
  sheetPrompt: { backgroundColor: SURFACE, borderRadius: 14, borderWidth: 1, borderColor: CARD_BORDER, padding: obSpacing.lg, gap: obSpacing.xs },
  sheetPromptLabel: { fontFamily: obFonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
  sheetPromptAnswer: { fontFamily: obFonts.heading, fontSize: 19, lineHeight: 26, color: obColors.textPrimary },
  commentInput: {
    minHeight: 88,
    maxHeight: 160,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: obColors.border,
    backgroundColor: SURFACE,
    padding: obSpacing.md,
    fontFamily: obFonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: obColors.textPrimary,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', marginTop: -obSpacing.sm, fontFamily: obFonts.body, fontSize: 12, lineHeight: 16, color: obColors.textSecondary },
  cancel: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  link: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.cta },
  chatWho: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm, flexShrink: 1 },
  chatAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: obColors.selectedFill },
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: obSpacing.sm,
    paddingHorizontal: obSpacing.lg,
    paddingTop: obSpacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: CARD_BORDER,
  },
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
