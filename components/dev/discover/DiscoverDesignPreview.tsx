// DEV-only interactive preview of the proposed Discover (home) design: one
// full profile at a time, read top to bottom, with a heart and an inline
// "Add a comment" on every photo and prompt, and × to pass. Local fixtures
// and a pure reducer only (lib/dev/discoverPreview.ts): no Supabase import,
// so nothing is liked, sent, passed or reset on a real account. The real
// Discover tab is unchanged. Opened from app/dev/discover-preview.tsx.
//
// Not approved yet, deliberately absent: swipe, like/pass animations, green
// "liked" hearts, toast boxes, LIKE/NOPE stamps. A decision simply shows the
// next profile.
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
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

import { DiscoverProfileItems, type ItemHandlers } from '@/components/dev/discover/DiscoverProfileItems';
import { PreviewTabBar } from '@/components/dev/discover/PreviewTabBar';
import { TempaWordmark } from '@/components/onboarding-v2/TempaWordmark';
import {
  buildDiscoverLayout,
  currentPersonId,
  describeDecision,
  discoverReducer,
  INITIAL_DISCOVER_STATE,
  likesLeftLabel,
  personById,
} from '@/lib/dev/discoverPreview';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

const HEADER_HEIGHT = 48;

export function DiscoverDesignPreview({ onExit }: { onExit: () => void }) {
  const insets = useSafeAreaInsets();
  const [state, dispatch] = useReducer(discoverReducer, INITIAL_DISCOVER_STATE);
  const person = personById(currentPersonId(state));
  const items = useMemo(() => (person ? buildDiscoverLayout(person) : []), [person]);

  // ── Keyboard: hide the tab bar and ×, keep the open editor visible ──────
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const frameRef = useRef<View>(null);
  const editorRef = useRef<View | null>(null);
  const scrollY = useRef(0);
  const keyboardTop = useRef<number | null>(null);

  /** Scrolls only as much as needed so the editor (input + Send) sits above
   * the keyboard — never back to the top. Works for iOS (keyboard overlaps
   * the frame) and Android (window resized: overlap 0). */
  const keepEditorVisible = useCallback(() => {
    const frame = frameRef.current;
    const editor = editorRef.current;
    if (!frame || !editor) return;
    requestAnimationFrame(() => {
      frame.measureInWindow((_fx, fy, _fw, fh) => {
        editor.measureInWindow((_ex, ey, _ew, eh) => {
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

  // Switching the editor to another photo/prompt while the keyboard is
  // already up fires no keyboard event: re-check visibility ourselves.
  const editorTarget = state.editor?.target;
  useEffect(() => {
    if (!editorTarget || keyboardTop.current === null) return;
    const t = setTimeout(keepEditorVisible, 80);
    return () => clearTimeout(t);
  }, [editorTarget, keepEditorVisible]);

  // ── Hero fills the space between header and tab bar. Frozen while an
  // editor / keyboard is open so the tab bar hiding (or an Android resize)
  // never changes the hero and makes the profile jump. ──────────────────────
  const [frameHeight, setFrameHeight] = useState(0);
  const freeze = keyboardOpen || !!state.editor;
  const onFrameLayout = (e: LayoutChangeEvent) => {
    if (!freeze) setFrameHeight(e.nativeEvent.layout.height);
  };

  // A decision shows the next profile from its top.
  const decisions = state.decisions.length;
  useEffect(() => {
    Keyboard.dismiss();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [decisions]);

  const handlers: ItemHandlers | null = person
    ? {
        person,
        heroHeight: Math.max(frameHeight, 360),
        editor: state.editor,
        canLike: state.likesLeft > 0,
        onLike: (target) => dispatch({ type: 'like', personId: person.id, target }),
        onOpenComment: (target) => dispatch({ type: 'open_comment', personId: person.id, target }),
        onEditComment: (text) => dispatch({ type: 'edit_comment', text }),
        onCancelComment: () => {
          Keyboard.dismiss();
          dispatch({ type: 'cancel_comment' });
        },
        onSendComment: () => dispatch({ type: 'send_comment', personId: person.id }),
        onEditorResize: () => {
          if (keyboardTop.current !== null) keepEditorVisible();
        },
        editorRef: (v) => {
          editorRef.current = v;
        },
      }
    : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TempaWordmark />
          <TouchableOpacity onPress={onExit} hitSlop={10} accessibilityRole="button" accessibilityLabel="Exit Discover design preview">
            <Text style={styles.devPill}>DEV ✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerRight} accessible accessibilityLabel={likesLeftLabel(state.likesLeft)}>
          <Text style={styles.likesLeft} maxFontSizeMultiplier={1.4}>{likesLeftLabel(state.likesLeft)}</Text>
          {/* Shown for the layout only; filters are not part of this preview. */}
          <Ionicons name="options-outline" size={24} color={obColors.textPrimary} accessible={false} importantForAccessibility="no" />
        </View>
      </View>

      <View ref={frameRef} style={styles.frame} onLayout={onFrameLayout} collapsable={false}>
        {person && handlers ? (
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
              contentContainerStyle={{ paddingBottom: 96 }}>
              <DiscoverProfileItems items={items} h={handlers} />
              <DevPanel
                last={describeDecision(state.decisions[state.decisions.length - 1])}
                onReset={(shortFirst) => dispatch({ type: 'reset', shortFirst })}
                onExit={onExit}
              />
            </ScrollView>
            {!keyboardOpen ? (
              <TouchableOpacity
                onPress={() => dispatch({ type: 'pass', personId: person.id })}
                style={styles.pass}
                accessibilityRole="button"
                accessibilityLabel={`Pass on ${person.name}`}>
                <Ionicons name="close" size={30} color={obColors.textPrimary} />
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          <View style={styles.end}>
            <Text style={styles.endTitle}>That’s everyone in this preview</Text>
            <Text style={styles.endText}>{describeDecision(state.decisions[state.decisions.length - 1])}. The real end-of-list and out-of-likes screens are a later work package.</Text>
            <DevPanel last={null} onReset={(shortFirst) => dispatch({ type: 'reset', shortFirst })} onExit={onExit} />
          </View>
        )}
      </View>

      {!keyboardOpen ? <PreviewTabBar bottomInset={insets.bottom} /> : null}
    </View>
  );
}

function DevPanel({ last, onReset, onExit }: { last: string | null; onReset: (shortFirst: boolean) => void; onExit: () => void }) {
  const btn = (label: string, onPress: () => void) => (
    <TouchableOpacity key={label} onPress={onPress} style={styles.devBtn} accessibilityRole="button">
      <Text style={styles.devBtnText} maxFontSizeMultiplier={1.4}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.dev}>
      <Text style={styles.devTitle}>Preview controls · DEV</Text>
      {last ? <Text style={styles.devText}>{`Last: ${last}`}</Text> : null}
      <Text style={styles.devText}>
        Local sample data only. Nothing is liked, sent, passed or saved. Photos are illustrated placeholders, not final images.
      </Text>
      <View style={styles.devRow}>
        {btn('Reset (full profile first)', () => onReset(false))}
        {btn('Reset (short profile first)', () => onReset(true))}
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
    justifyContent: 'space-between',
    paddingHorizontal: obSpacing.lg + 4,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md },
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
  likesLeft: { fontFamily: obFonts.bodyMedium, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  frame: { flex: 1 },
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
  end: { flex: 1, justifyContent: 'center', padding: obSpacing.gutter, gap: obSpacing.md },
  endTitle: { fontFamily: obFonts.heading, fontSize: 24, lineHeight: 31, color: obColors.textPrimary, textAlign: 'center' },
  endText: { fontFamily: obFonts.body, fontSize: 15, lineHeight: 21, color: obColors.textSecondary, textAlign: 'center' },
  dev: {
    marginHorizontal: obSpacing.md,
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
  devBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: obSpacing.md, borderRadius: 10, borderWidth: 1, borderColor: obColors.border, backgroundColor: '#FFFDF8' },
  devBtnText: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
});
