// Real V2 Discover (active V2 members on V2 backends) — the design approved
// on the phone in the DEV preview (2026-10-08): full-screen main photo, the
// approved profile order, compact prompts, About, a heart and an inline
// "Add a comment" on every photo and prompt, × to pass.
//
// Data: candidates in the existing server order (no score), the public
// profile with stable content ids (get_profile_v2), the server like quota,
// and one write path — send_like_v2 (like + optional comment + quota in one
// server transaction; same request id on retry). Rules:
//   • heart OK → next person; comment Send OK → same person, the sent note
//     in place, then "Next profile" (records nothing, works at 0 likes);
//   • failure → no success shown, no advance, the comment draft stays;
//     an unknown result keeps its request id so a retry can't double;
//   • × passes locally (unchanged: Discover never recorded passes).
// No DEV fixtures here (they live in components/dev/discover only).
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type KeyboardEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoverProfileItems, type EditorState, type ItemHandlers, type SentNoteState } from '@/components/discover/DiscoverProfileItems';
import { TempaWordmark } from '@/components/onboarding-v2/TempaWordmark';
import {
  likeOutcome,
  likesLeftText,
  loadCandidateIds,
  loadQuota,
  loadRealProfile,
  requestIdFor,
  sendLikeV2,
  type PendingAttempt,
  type Quota,
  type RealProfile,
} from '@/lib/discover/discoverV2';
import { buildDiscoverLayout, chromeVisibility, STATE_COPY } from '@/lib/discover/profileLayout';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { forgetProfilePhotoUrls } from '@/lib/resolveProfilePhotoUrl';
import { supabase } from '@/lib/supabaseClient';

const HEADER_HEIGHT = 48;
const ACTION_BAR_HEIGHT = 60;

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

type Load = 'loading' | 'error' | 'ready';

export function V2DiscoverScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // The real tab bar steps aside while typing (approved preview behaviour).
  useEffect(() => {
    navigation.setOptions({ tabBarHideOnKeyboard: true } as never);
  }, [navigation]);

  // ── Candidates + current profile ─────────────────────────────────────────
  const [load, setLoad] = useState<Load>('loading');
  const [ids, setIds] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [profile, setProfile] = useState<RealProfile | null>(null);
  const [profileLoad, setProfileLoad] = useState<Load>('loading');
  const [reloadProfileKey, setReloadProfileKey] = useState(0);
  const [quota, setQuota] = useState<Quota | null>(null);

  const loadAll = useCallback(async () => {
    setLoad('loading');
    try {
      const next = await loadCandidateIds();
      setIds(next);
      setIndex(0);
      setLoad('ready');
    } catch {
      // A failed load is never shown as "no one left".
      setLoad('error');
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      void loadQuota().then((q) => q && setQuota(q));
    }, []),
  );

  const currentId = load === 'ready' ? ids[index] ?? null : null;

  // Per-person UI state (reset on every new person).
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [sent, setSent] = useState<SentNoteState | null>(null);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const pending = useRef<PendingAttempt | null>(null);

  useEffect(() => {
    setEditor(null);
    setEditorError(null);
    setSent(null);
    setDone(false);
    setNotice(null);
    Keyboard.dismiss();
    if (!currentId) {
      setProfile(null);
      return;
    }
    let live = true;
    setProfileLoad('loading');
    void loadRealProfile(currentId)
      .then((p) => {
        if (!live) return;
        // No longer visible (blocked / hidden / deleted / not eligible): skip.
        if (!p) return setIndex((i) => i + 1);
        setProfile(p);
        setProfileLoad('ready');
      })
      .catch(() => live && setProfileLoad('error'));
    return () => {
      live = false;
    };
  }, [currentId, reloadProfileKey]);

  const person = profile && profile.person.id === currentId ? profile.person : null;
  const items = useMemo(() => (person ? buildDiscoverLayout(person) : []), [person]);
  const next = useCallback(() => setIndex((i) => i + 1), []);

  // ── Keyboard: keep the open editor visible (same as the approved preview) ─
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const frameRef = useRef<View>(null);
  const editorRef = useRef<View | null>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);

  const keepEditorVisible = useCallback(() => {
    const frame = frameRef.current;
    const ed = editorRef.current;
    if (!frame || !ed) return;
    requestAnimationFrame(() => {
      frame.measureInWindow((_fx, fy, _fw, fh) => {
        ed.measureInWindow((_ex, ey, _ew, eh) => {
          const kb = keyboardTop.current;
          const visibleBottom = Math.min(fy + fh, kb ?? fy + fh) - obSpacing.md;
          const below = ey + eh - visibleBottom;
          const above = fy + obSpacing.md - ey;
          if (below > 0) scrollRef.current?.scrollTo({ y: scrollY.current + below, animated: true });
          else if (above > 0) scrollRef.current?.scrollTo({ y: Math.max(0, scrollY.current - above), animated: true });
        });
      });
    });
  }, []);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const onShow = (e: KeyboardEvent) => {
      keyboardTop.current = e.endCoordinates.screenY;
      setKeyboardOpen(true);
    };
    const onHide = () => {
      keyboardTop.current = null;
      setKeyboardOpen(false);
    };
    const subs = [
      Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', onShow),
      Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', onHide),
      Keyboard.addListener('keyboardDidShow', (e) => {
        keyboardTop.current = e.endCoordinates.screenY;
        keepEditorVisible();
      }),
    ];
    return () => subs.forEach((s) => s.remove());
  }, [keepEditorVisible]);

  const editorTarget = editor?.target;
  useEffect(() => {
    if (!editorTarget || keyboardTop.current === null) return;
    const t = setTimeout(keepEditorVisible, 80);
    return () => clearTimeout(t);
  }, [editorTarget, keepEditorVisible]);

  const [frameHeight, setFrameHeight] = useState(0);
  const freeze = keyboardOpen || !!editor;
  const onFrameLayout = (e: LayoutChangeEvent) => {
    if (!freeze) setFrameHeight(e.nativeEvent.layout.height);
  };

  // ── Sending ──────────────────────────────────────────────────────────────
  const outOfLikes = quota !== null && quota.remaining <= 0;

  const send = useCallback(
    async (target: string, note: string | null) => {
      if (!person || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      setNotice(null);
      setEditorError(null);
      const noteText = note?.trim() ?? '';
      const requestId = requestIdFor(pending.current, person.id, target, noteText, uuid);
      pending.current = { likeeId: person.id, target, note: noteText, requestId };
      const result = await sendLikeV2(person.id, target, noteText || null, requestId);
      const out = likeOutcome(result, !!noteText, person.name || 'them');
      if (result.kind !== 'unknown' && result.quota) setQuota(result.quota);
      else if (result.kind === 'refused') void loadQuota().then((q) => q && setQuota(q));
      if (!out.keepPending) pending.current = null;
      // like_sent is logged by the server inside send_like_v2 (once per like).

      busyRef.current = false;
      setBusy(false);
      if (out.advance) return next();
      if (out.showSent) {
        setEditor(null);
        setSent({ target, comment: noteText });
      }
      if (!out.keepEditor && !out.showSent) setEditor(null);
      if (out.done) setDone(true);
      if (out.reloadProfile) setReloadProfileKey((k) => k + 1);
      if (out.message) {
        if (out.keepEditor) setEditorError(out.message);
        else setNotice(out.message);
      }
    },
    [person, next],
  );

  const liked = done || !!sent;
  const kind = load === 'error' ? 'error' : load === 'ready' && !currentId ? 'empty' : 'profile';
  const chrome = chromeVisibility({ kind, keyboardOpen, editorOpen: !!editor, liked, outOfLikes });
  const showActionBar = !!person && (chrome.nextProfile || chrome.outOfLikesNote || (!!notice && !chrome.typing));

  const handlers: ItemHandlers | null = person
    ? {
        person,
        photoSource: (i) => (profile?.photoUrls[i] ? { uri: profile.photoUrls[i] } : null),
        heroHeight: Math.max(frameHeight + (liked && showActionBar ? ACTION_BAR_HEIGHT : 0), 360),
        editor,
        busy,
        editorError,
        canLike: !outOfLikes && !liked,
        liked,
        sent,
        onLike: (target) => void send(target, null),
        onOpenComment: (target) => {
          if (liked || outOfLikes || busyRef.current) return;
          setEditorError(null);
          setEditor((e) => (e && e.target === target ? e : { target, draft: '' }));
        },
        onEditComment: (text) => setEditor((e) => (e ? { ...e, draft: text.slice(0, 240) } : e)),
        onCancelComment: () => {
          Keyboard.dismiss();
          keyboardTop.current = null;
          setKeyboardOpen(false);
          setEditor(null);
          setEditorError(null);
        },
        onSendComment: () => {
          if (!editor || !editor.draft.trim()) return;
          Keyboard.dismiss();
          keyboardTop.current = null;
          setKeyboardOpen(false);
          void send(editor.target, editor.draft);
        },
        onEditorResize: () => {
          if (keyboardTop.current !== null) keepEditorVisible();
        },
        editorRef: (v) => {
          editorRef.current = v;
        },
      }
    : null;

  // ── Block / report (kept from the previous Discover) ─────────────────────
  const block = () => {
    if (!person) return;
    Alert.alert('Block', `Block ${person.name || 'this person'}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          const { data: s } = await supabase.auth.getSession();
          const me = s.session?.user?.id;
          if (!me) return;
          const { error } = await supabase.from('blocks').insert({ blocker_id: me, blocked_id: person.id });
          if (error) return Alert.alert('Could not block', 'Please try again.');
          forgetProfilePhotoUrls(person.id);
          next();
        },
      },
    ]);
  };
  const report = () => {
    if (!person) return;
    const sendReport = async (reason: string) => {
      const { data: s } = await supabase.auth.getSession();
      const me = s.session?.user?.id;
      if (!me) return;
      const { error } = await supabase.from('reports').insert({ reporter_id: me, reported_id: person.id, reason });
      Alert.alert(error ? 'Could not send report' : 'Report sent', error ? 'Please try again.' : 'Thanks for letting us know.');
    };
    Alert.alert('Report', `Why are you reporting ${person.name || 'this person'}?`, [
      { text: 'Fake profile', onPress: () => void sendReport('Fake profile') },
      { text: 'Inappropriate content', onPress: () => void sendReport('Inappropriate content') },
      { text: 'Something else', onPress: () => void sendReport('Something else') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TempaWordmark />
        <View style={styles.headerRight}>
          {quota ? (
            <Text style={styles.likesLeft} maxFontSizeMultiplier={1.4} accessibilityLabel={likesLeftText(quota)}>
              {likesLeftText(quota)}
            </Text>
          ) : null}
          <TouchableOpacity onPress={() => router.push('/filters' as never)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Filters">
            <Ionicons name="options-outline" size={24} color={obColors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <View ref={frameRef} style={styles.frame} onLayout={onFrameLayout} collapsable={false}>
        {kind === 'error' ? (
          <StateScreen icon="cloud-offline-outline" title={STATE_COPY.errorTitle} text={STATE_COPY.errorText} action={{ label: STATE_COPY.retry, onPress: () => void loadAll() }} />
        ) : kind === 'empty' ? (
          <StateScreen icon="compass-outline" title={STATE_COPY.emptyTitle} text={STATE_COPY.emptyText} />
        ) : load === 'loading' || (profileLoad === 'loading' && !person) ? (
          <View style={styles.center}>
            <ActivityIndicator color={obColors.cta} accessibilityLabel="Loading profiles" />
          </View>
        ) : profileLoad === 'error' && !person ? (
          <StateScreen
            icon="cloud-offline-outline"
            title="Couldn’t load this profile"
            text={STATE_COPY.errorText}
            action={{ label: STATE_COPY.retry, onPress: () => setReloadProfileKey((k) => k + 1) }}
          />
        ) : person && handlers ? (
          <>
            <ScrollView
              ref={scrollRef}
              key={person.id}
              onScroll={(e) => {
                scrollY.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={32}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="none"
              automaticallyAdjustKeyboardInsets
              contentContainerStyle={{ paddingBottom: liked ? obSpacing.xl : 96 }}>
              <DiscoverProfileItems items={items} h={handlers} />
              <View style={styles.safety}>
                <TouchableOpacity onPress={block} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Block ${person.name}`}>
                  <Text style={styles.safetyText}>{`Block ${person.name || ''}`.trim()}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={report} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Report ${person.name}`}>
                  <Text style={styles.safetyText}>Report</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            {chrome.pass ? (
              <TouchableOpacity onPress={next} disabled={busy} style={styles.pass} accessibilityRole="button" accessibilityLabel={`Pass on ${person.name}`}>
                <Ionicons name="close" size={30} color={obColors.textPrimary} />
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}
      </View>

      {showActionBar ? (
        <View style={styles.actionBar}>
          {notice ? (
            <Text style={styles.notice} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.4}>
              {notice}
            </Text>
          ) : null}
          {chrome.nextProfile ? (
            // Moves on only: records no like and no pass, works at 0 likes.
            <TouchableOpacity onPress={next} style={styles.next} accessibilityRole="button" accessibilityLabel="Next profile">
              <Text style={styles.nextText}>Next profile</Text>
              <Ionicons name="chevron-forward" size={18} color={obColors.onCta} importantForAccessibility="no" />
            </TouchableOpacity>
          ) : chrome.outOfLikesNote ? (
            <View style={styles.outOfLikes} accessible accessibilityLabel={STATE_COPY.outOfLikes}>
              <Ionicons name="heart-dislike-outline" size={18} color={obColors.textSecondary} importantForAccessibility="no" />
              <Text style={styles.outOfLikesText} maxFontSizeMultiplier={1.4}>{STATE_COPY.outOfLikes}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function StateScreen({
  icon,
  title,
  text,
  action,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.stateBody} accessibilityLiveRegion="polite">
      <Ionicons name={icon} size={36} color={obColors.cta} importantForAccessibility="no" />
      <Text style={styles.stateTitle} accessibilityRole="header">{title}</Text>
      <Text style={styles.stateText}>{text}</Text>
      {action ? (
        <TouchableOpacity onPress={action.onPress} style={styles.retry} accessibilityRole="button">
          <Text style={styles.retryText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: obSpacing.lg + 4,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md },
  likesLeft: { fontFamily: obFonts.bodyMedium, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  frame: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pass: {
    position: 'absolute',
    left: obSpacing.lg,
    bottom: obSpacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  actionBar: {
    minHeight: ACTION_BAR_HEIGHT,
    justifyContent: 'center',
    gap: obSpacing.xs,
    paddingHorizontal: obSpacing.lg,
    paddingVertical: obSpacing.sm,
    backgroundColor: obColors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4DCCB',
  },
  notice: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
  next: {
    alignSelf: 'stretch',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 12,
    backgroundColor: obColors.cta,
  },
  nextText: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 21, color: obColors.onCta },
  outOfLikes: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm },
  outOfLikesText: { flex: 1, fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
  safety: { flexDirection: 'row', justifyContent: 'center', gap: obSpacing.xl, paddingTop: obSpacing.xl, paddingBottom: obSpacing.md },
  safetyText: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textSecondary, textDecorationLine: 'underline' },
  stateBody: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: obSpacing.md, paddingHorizontal: obSpacing.gutter },
  stateTitle: { fontFamily: obFonts.heading, fontSize: 24, lineHeight: 31, color: obColors.textPrimary, textAlign: 'center' },
  stateText: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary, textAlign: 'center' },
  retry: { minHeight: 48, paddingHorizontal: obSpacing.xl, borderRadius: 12, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center', marginTop: obSpacing.xs },
  retryText: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 21, color: obColors.onCta },
});
