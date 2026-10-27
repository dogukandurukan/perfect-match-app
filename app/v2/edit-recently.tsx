// "Recently" editor (D106): a book (title — author) and a song (title —
// artist, optional music link). Typed by hand; nothing is fetched. Same
// behaviour as the other profile editors:
//   • a local draft until Save; nothing looks saved until the server said so;
//     a failure keeps the draft for a retry;
//   • the row version this screen loaded is sent back — a change made
//     elsewhere → "Reload" (asks first when the draft has unsaved changes);
//   • leaving with unsaved changes asks "Discard changes?";
//   • "Remove book" / "Remove song" clear that part; Save then removes it.
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { OnboardingTextField } from '@/components/onboarding-v2/OnboardingTextField';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { loadMyRecently, saveMyRecently } from '@/lib/profile/recently';
import { EMPTY_RECENTLY, RECENTLY_LIMITS, recentlyProblem, sameRecently, type RecentlyDraft } from '@/lib/profile/recentlyCore';

type Load = { kind: 'loading' } | { kind: 'error'; text: string } | { kind: 'ready' };
type Banner = { kind: 'error'; text: string; changed: boolean } | { kind: 'saved' } | null;

export default function EditRecentlyScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [saved, setSaved] = useState<RecentlyDraft>(EMPTY_RECENTLY);
  const [version, setVersion] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecentlyDraft>(EMPTY_RECENTLY);
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const busy = useRef(false);
  const dirty = !sameRecently(draft, saved);
  const problem = recentlyProblem(draft);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoad({ kind: 'loading' });
      const r = await loadMyRecently();
      if (!live) return;
      if (!r.ok) return setLoad({ kind: 'error', text: r.text });
      setSaved(r.draft);
      setDraft(r.draft);
      setVersion(r.version);
      setBanner(null);
      setLoad({ kind: 'ready' });
    })();
    return () => {
      live = false;
    };
  }, [reload]);

  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: { preventDefault: () => void; data: { action: unknown } }) => {
      if (!dirty || busy.current) return;
      e.preventDefault();
      Alert.alert('Discard changes?', 'Your changes haven’t been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action as never) },
      ]);
    });
    return unsub;
  }, [navigation, dirty]);

  const save = useCallback(async () => {
    if (busy.current || !dirty || problem) return;
    busy.current = true;
    setSaving(true);
    setBanner(null);
    const r = await saveMyRecently(draft, version);
    busy.current = false;
    setSaving(false);
    if (r.ok) {
      setSaved(r.draft);
      setDraft(r.draft);
      setVersion(r.version);
      setBanner({ kind: 'saved' });
      return;
    }
    setBanner({ kind: 'error', text: r.text, changed: r.changed });
  }, [draft, version, dirty, problem]);

  const reloadLatest = () => {
    if (!dirty) return setReload((n) => n + 1);
    Alert.alert('Reload?', 'Your unsaved changes will be replaced by the saved ones.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reload', onPress: () => setReload((n) => n + 1) },
    ]);
  };

  const set = (p: Partial<RecentlyDraft>) => {
    setBanner(null);
    setDraft((d) => ({ ...d, ...p }));
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.4}>
        Recently
      </Text>
      <View style={styles.iconBtn} />
    </View>
  );

  if (load.kind !== 'ready') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          {load.kind === 'loading' ? (
            <ActivityIndicator color={obColors.cta} />
          ) : (
            <>
              <Text style={styles.body}>{load.text}</Text>
              <OnboardingPrimaryButton label="Try again" variant="outline" onPress={() => setReload((n) => n + 1)} />
            </>
          )}
        </View>
      </View>
    );
  }

  const hasBook = !!(draft.bookTitle.trim() || draft.bookAuthor.trim());
  const hasSong = !!(draft.songTitle.trim() || draft.songArtist.trim() || draft.songUrl.trim());

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: obSpacing.xl }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
          Optional. Shown under your name on your profile and stays until you change it.
        </Text>

        <View style={styles.group}>
          <View style={styles.groupHead}>
            <Ionicons name="book-outline" size={18} color={obColors.textPrimary} importantForAccessibility="no" />
            <Text style={styles.groupTitle} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
              Book
            </Text>
          </View>
          <OnboardingTextField label="Book title" value={draft.bookTitle} onChangeText={(bookTitle) => set({ bookTitle })} maxLength={RECENTLY_LIMITS.bookTitle} autoCapitalize="words" returnKeyType="next" />
          <OnboardingTextField label="Author (optional)" value={draft.bookAuthor} onChangeText={(bookAuthor) => set({ bookAuthor })} maxLength={RECENTLY_LIMITS.bookAuthor} autoCapitalize="words" returnKeyType="next" />
          {hasBook ? (
            <TouchableOpacity onPress={() => set({ bookTitle: '', bookAuthor: '' })} disabled={saving} hitSlop={8} accessibilityRole="button" style={styles.textBtn}>
              <Text style={styles.link}>Remove book</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.group}>
          <View style={styles.groupHead}>
            <Ionicons name="musical-note-outline" size={18} color={obColors.textPrimary} importantForAccessibility="no" />
            <Text style={styles.groupTitle} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
              Song
            </Text>
          </View>
          <OnboardingTextField label="Song title" value={draft.songTitle} onChangeText={(songTitle) => set({ songTitle })} maxLength={RECENTLY_LIMITS.songTitle} autoCapitalize="words" returnKeyType="next" />
          <OnboardingTextField label="Artist (optional)" value={draft.songArtist} onChangeText={(songArtist) => set({ songArtist })} maxLength={RECENTLY_LIMITS.songArtist} autoCapitalize="words" returnKeyType="next" />
          <OnboardingTextField
            label="Link (optional)"
            value={draft.songUrl}
            onChangeText={(songUrl) => set({ songUrl })}
            maxLength={RECENTLY_LIMITS.songUrl}
            placeholder="https://open.spotify.com/…"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            textContentType="URL"
            returnKeyType="done"
          />
          <Text style={styles.small} maxFontSizeMultiplier={1.6}>
            An https link from a music service, e.g. Spotify, Apple Music, YouTube or SoundCloud. It opens outside Tempa.
          </Text>
          {hasSong ? (
            <TouchableOpacity onPress={() => set({ songTitle: '', songArtist: '', songUrl: '' })} disabled={saving} hitSlop={8} accessibilityRole="button" style={styles.textBtn}>
              <Text style={styles.link}>Remove song</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, obSpacing.md) }]}>
        {banner?.kind === 'error' ? (
          <View style={styles.bannerRow}>
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {banner.text}
            </Text>
            {banner.changed ? (
              <TouchableOpacity onPress={reloadLatest} hitSlop={8} accessibilityRole="button" accessibilityLabel="Reload">
                <Text style={styles.link}>Reload</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : banner?.kind === 'saved' && !dirty ? (
          <Text style={styles.saved} accessibilityLiveRegion="polite">
            Saved
          </Text>
        ) : dirty && problem ? (
          <Text style={styles.problem} accessibilityLiveRegion="polite">
            {problem}
          </Text>
        ) : null}
        <OnboardingPrimaryButton label={saving ? 'Saving…' : 'Save'} onPress={() => void save()} disabled={saving || !dirty || !!problem} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: obSpacing.sm, minHeight: 52, backgroundColor: obColors.background },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: obFonts.heading, fontSize: 22, lineHeight: 29, color: obColors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: obSpacing.md, paddingHorizontal: obSpacing.gutter },
  body: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textPrimary, textAlign: 'center' },
  scroll: { paddingHorizontal: obSpacing.gutter, paddingTop: obSpacing.sm, gap: obSpacing.xl },
  hint: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary },
  group: { gap: obSpacing.md },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm },
  groupTitle: { fontFamily: obFonts.bodySemiBold, fontSize: 17, lineHeight: 23, color: obColors.textPrimary },
  small: { fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  textBtn: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  footer: { paddingHorizontal: obSpacing.gutter, paddingTop: obSpacing.sm, gap: obSpacing.sm, backgroundColor: obColors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4DCCB' },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm, flexWrap: 'wrap' },
  error: { flex: 1, fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.error },
  problem: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.error, textAlign: 'center' },
  link: { fontFamily: obFonts.bodySemiBold, fontSize: 14, lineHeight: 19, color: obColors.cta, textDecorationLine: 'underline' },
  saved: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.cta, textAlign: 'center' },
});
