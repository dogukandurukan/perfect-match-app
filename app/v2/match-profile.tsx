// The full profile opened from the real V2 Matches cards — the approved
// Discover layout through the shared components. "Picked for you": a heart
// or an inline comment sends ONE like through send_like_v2 with source
// 'daily_pick' (validated by the server against the CURRENT pick); heart →
// back to Matches (card shows Like sent), comment → stays with the sent note.
// An outdated pick is refused before anything is spent and the user is asked
// to refresh Matches. "You both liked": read-only (already a match).
// Back always returns to Matches; there is no "next candidate" here.
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DiscoverProfileItems, type EditorState, type ItemHandlers, type SentNoteState } from '@/components/discover/DiscoverProfileItems';
import { useInlineEditorKeyboard } from '@/components/discover/useInlineEditorKeyboard';
import {
  likeOutcome,
  loadQuota,
  loadRealProfile,
  requestIdFor,
  sendLikeV2,
  type PendingAttempt,
  type Quota,
  type RealProfile,
} from '@/lib/discover/discoverV2';
import { buildDiscoverLayout, COMMENT_MAX, STATE_COPY } from '@/lib/discover/profileLayout';
import { loadDailyPicks, type DailyCard } from '@/lib/matches/dailyPicksV2';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

type Load = 'loading' | 'error' | 'unavailable' | 'ready';

export default function MatchProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId, kind } = useLocalSearchParams<{ userId?: string; kind?: string }>();
  const id = String(userId ?? '');
  const isPick = kind === 'pick';

  const [load, setLoad] = useState<Load>('loading');
  const [profile, setProfile] = useState<RealProfile | null>(null);
  const [card, setCard] = useState<DailyCard | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    setLoad('loading');
    void (async () => {
      try {
        const [p, d, q] = await Promise.all([loadRealProfile(id), loadDailyPicks(), loadQuota()]);
        if (!live) return;
        if (!p) return setLoad('unavailable');
        setProfile(p);
        setQuota(q);
        const c = d.kind === 'ok' ? (isPick ? d.value.pick : d.value.mutual) : null;
        const current = c && c.user_id === id ? c : null;
        setCard(current);
        // Opened from an older Matches screen: today's pick is someone else.
        if (isPick && d.kind === 'ok' && !current) {
          setStale(true);
          setNotice('Today’s pick has changed. Go back to Matches to see it.');
        }
        setLoad('ready');
      } catch {
        if (live) setLoad('error');
      }
    })();
    return () => {
      live = false;
    };
  }, [id, isPick, reload]);

  const person = profile?.person ?? null;
  const items = useMemo(() => (person ? buildDiscoverLayout(person) : []), [person]);

  // Liking is possible only on today's pick, still in state "new".
  const [sent, setSent] = useState<SentNoteState | null>(null);
  const [done, setDone] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const pending = useRef<PendingAttempt | null>(null);

  const existingLike = card?.like;
  const existingSent: SentNoteState | null =
    existingLike?.note && existingLike.target_key ? { target: `${existingLike.target_type}:${existingLike.target_key}`, comment: existingLike.note } : null;
  const liked = done || !!sent || (!!card && card.state !== 'new');
  const outOfLikes = quota !== null && quota.remaining <= 0;
  const canLike = isPick && !!card && card.state === 'new' && !liked && !outOfLikes && !stale;

  const kb = useInlineEditorKeyboard(editor?.target);
  const [frameHeight, setFrameHeight] = useState(0);
  const onFrameLayout = (e: LayoutChangeEvent) => {
    if (!kb.keyboardOpen && !editor) setFrameHeight(e.nativeEvent.layout.height);
  };

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
      const result = await sendLikeV2(person.id, target, noteText || null, requestId, 'daily_pick');
      const out = likeOutcome(result, !!noteText, person.name || 'them');
      if (result.kind !== 'unknown' && result.quota) setQuota(result.quota);
      if (!out.keepPending) pending.current = null;
      busyRef.current = false;
      setBusy(false);
      // Heart OK → back to Matches (the card shows Like sent).
      if (out.advance) return router.back();
      if (out.showSent) {
        setEditor(null);
        setSent({ target, comment: noteText });
      }
      if (out.refreshPicks) {
        setStale(true);
        setEditor(null);
      }
      if (!out.keepEditor && !out.showSent) setEditor(null);
      if (out.done) setDone(true);
      if (out.reloadProfile) setReload((n) => n + 1);
      if (out.message) {
        if (out.keepEditor && !out.refreshPicks) setEditorError(out.message);
        else setNotice(out.message);
      }
    },
    [person, router],
  );

  const h: ItemHandlers | null = person && profile
    ? {
        person,
        photoSource: (i) => (profile.photoUrls[i] ? { uri: profile.photoUrls[i] } : null),
        heroHeight: Math.max(frameHeight, 360),
        editor,
        busy,
        editorError,
        canLike,
        liked: !canLike,
        sent: sent ?? existingSent,
        onLike: (target) => void send(target, null),
        onOpenComment: (target) => {
          if (!canLike || busyRef.current) return;
          setEditorError(null);
          setEditor((e) => (e && e.target === target ? e : { target, draft: '' }));
        },
        onEditComment: (text) => setEditor((e) => (e ? { ...e, draft: text.slice(0, COMMENT_MAX) } : e)),
        onCancelComment: () => {
          kb.closeKeyboard();
          setEditor(null);
          setEditorError(null);
        },
        onSendComment: () => {
          if (!editor || !editor.draft.trim()) return;
          kb.closeKeyboard();
          void send(editor.target, editor.draft);
        },
        onEditorResize: kb.onEditorResize,
        editorRef: kb.setEditorRef,
      }
    : null;

  const typing = kb.keyboardOpen && !!editor;
  const showBar = load === 'ready' && !typing && (!!notice || stale || (isPick && outOfLikes && !liked));

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Back to Matches">
          <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.4}>
          {person?.name ?? ''}
        </Text>
        <View style={styles.iconBtn} />
      </View>
      <View ref={kb.frameRef} style={styles.frame} onLayout={onFrameLayout} collapsable={false}>
        {load === 'loading' ? (
          <View style={styles.center}>
            <ActivityIndicator color={obColors.cta} accessibilityLabel="Loading profile" />
          </View>
        ) : load === 'error' ? (
          <View style={styles.center}>
            <Text style={styles.stateText}>{STATE_COPY.errorText}</Text>
            <TouchableOpacity onPress={() => setReload((n) => n + 1)} style={styles.btn} accessibilityRole="button">
              <Text style={styles.btnText}>{STATE_COPY.retry}</Text>
            </TouchableOpacity>
          </View>
        ) : load === 'unavailable' || !h ? (
          <View style={styles.center}>
            <Text style={styles.stateText}>This profile isn’t available.</Text>
          </View>
        ) : (
          <ScrollView
            ref={kb.scrollRef}
            onScroll={(e) => kb.onScroll(e.nativeEvent.contentOffset.y)}
            scrollEventThrottle={32}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={{ paddingBottom: obSpacing.xl }}>
            <DiscoverProfileItems items={items} h={h} />
          </ScrollView>
        )}
      </View>
      {showBar ? (
        <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {notice ? <Text style={styles.notice} accessibilityLiveRegion="polite">{notice}</Text> : null}
          {!notice && isPick && outOfLikes ? <Text style={styles.notice}>{STATE_COPY.outOfLikes}</Text> : null}
          {stale ? (
            <TouchableOpacity onPress={() => router.back()} style={styles.btn} accessibilityRole="button" accessibilityLabel="Back to Matches to refresh">
              <Text style={styles.btnText}>Back to Matches</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: obSpacing.sm, minHeight: 48 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flexShrink: 1, fontFamily: obFonts.heading, fontSize: 20, lineHeight: 26, color: obColors.textPrimary },
  frame: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: obSpacing.md, padding: obSpacing.gutter },
  stateText: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textPrimary, textAlign: 'center' },
  bar: {
    gap: obSpacing.sm,
    paddingHorizontal: obSpacing.lg,
    paddingTop: obSpacing.sm,
    backgroundColor: obColors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E4DCCB',
  },
  notice: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
  btn: { minHeight: 46, paddingHorizontal: obSpacing.xl, borderRadius: 12, backgroundColor: obColors.cta, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 21, color: obColors.onCta },
});
