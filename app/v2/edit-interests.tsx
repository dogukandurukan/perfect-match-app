// "Your interests" (D87–D97) — the ONLY profile editing an approved V2 member
// has: broad interests, activities, artists, books, movies/series and up to
// three conversation starters. Identity, photos, standard prompts and every
// other application field stay locked (server: v2_assert_editable untouched;
// these narrow operations change nothing else).
//
// Server-first saves (nothing looks saved until the server said so; a failure
// keeps the draft and shows an error):
//   • selections → save_interests_v2. Removing a subject that starters depend
//     on is refused until the user confirms; then the selection and ONLY those
//     starters change together.
//   • starters → the shared TakesEditor (save_take_v2 / delete_take_v2: new
//     never overwrites; edit keeps the id; another subject gets a new id and
//     nothing is carried over).
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivitiesField } from '@/components/interests/ActivitiesField';
import { TakesEditor } from '@/components/interests/TakesEditor';
import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { SelectedList, Typeahead } from '@/components/onboarding-v2/yourWorld/Typeahead';
import { InterestsFields } from '@/components/onboarding-v2/yourWorld/YourWorldFields';
import { loadMyInterests, saveSelections, type MyInterests } from '@/lib/interests/interestsV2';
import { orderedTakes, selectionsEqual, subjectOptions, takesRemovedBy, type Selections } from '@/lib/interests/takes';
import { LIVE_ATTRIBUTION } from '@/lib/onboardingV2/liveCatalog';
import { searchArtists, searchBooks, searchScreen, type SearchFn } from '@/lib/onboardingV2/tasteSearch';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import {
  EMPTY_WORLD_DRAFT,
  MAX_INTERESTS,
  MAX_TASTE,
  MIN_INTERESTS,
  addTaste,
  removeTaste,
  type TasteItem,
  type TasteKind,
  type WorldDraft,
} from '@/lib/onboardingV2/yourWorld';

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'unavailable'; message: string } | { kind: 'ready' };
type Banner = { kind: 'ok' | 'error'; text: string } | null;

const pick = (m: MyInterests): Selections => ({ interests: m.interests, activities: m.activities, artists: m.artists, books: m.books, screen: m.screen });

export default function EditInterestsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [saved, setSaved] = useState<MyInterests | null>(null);
  const [sel, setSel] = useState<Selections | null>(null);
  const [savingSel, setSavingSel] = useState(false);
  const [takeDirty, setTakeDirty] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoad({ kind: 'loading' });
      const r = await loadMyInterests();
      if (!live) return;
      if (r.kind === 'unsupported') return setLoad({ kind: 'unavailable', message: 'Editing interests isn’t available on this server yet.' });
      if (r.kind === 'error') return setLoad({ kind: 'error', message: r.message });
      if (!r.value.editable) return setLoad({ kind: 'unavailable', message: 'Your account can’t edit this right now.' });
      setSaved(r.value);
      setSel(pick(r.value));
      setLoad({ kind: 'ready' });
    })();
    return () => {
      live = false;
    };
  }, [reload]);

  const takes = useMemo(() => (saved ? orderedTakes(saved.takes) : []), [saved]);
  const options = useMemo(() => (saved ? subjectOptions(pick(saved)) : []), [saved]);
  const selDirty = !!saved && !!sel && !selectionsEqual(sel, pick(saved));
  const willRemove = sel ? takesRemovedBy(sel, takes) : [];
  const selValid = !!sel && sel.interests.length >= MIN_INTERESTS && sel.interests.length <= MAX_INTERESTS;

  // Leaving with unsaved changes asks first (nothing is saved silently).
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: { preventDefault: () => void; data: { action: unknown } }) => {
      if (!selDirty && !takeDirty) return;
      e.preventDefault();
      Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action as never) },
      ]);
    });
    return unsub;
  }, [navigation, selDirty, takeDirty]);

  const world: WorldDraft = sel ? { ...EMPTY_WORLD_DRAFT, interests: sel.interests } : EMPTY_WORLD_DRAFT;

  const doSaveSelections = useCallback(
    async (removeTakes: boolean) => {
      if (!sel || busy.current) return;
      busy.current = true;
      setSavingSel(true);
      setBanner(null);
      const r = await saveSelections(sel, removeTakes);
      busy.current = false;
      setSavingSel(false);
      if (r.kind === 'ok') {
        setSaved(r.value);
        setSel(pick(r.value));
        return setBanner({
          kind: 'ok',
          text: r.takesRemoved > 0 ? `Interests saved. ${r.takesRemoved === 1 ? '1 conversation starter was' : `${r.takesRemoved} conversation starters were`} removed.` : 'Interests saved',
        });
      }
      if (r.kind === 'confirm') {
        const names = r.takes.map((t) => t.subject_title).join(', ');
        const one = r.takes.length === 1;
        return Alert.alert(
          `Remove ${names}?`,
          `${one ? 'A conversation starter is' : `${r.takes.length} conversation starters are`} about ${names}. Removing ${one ? 'it' : 'them'} from your interests also removes ${one ? 'that answer' : 'those answers'}. Your other answers stay.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setBanner({ kind: 'error', text: 'Not saved. Your interests and conversation starters are unchanged.' }) },
            { text: 'Remove', style: 'destructive', onPress: () => void doSaveSelections(true) },
          ],
        );
      }
      setBanner({ kind: 'error', text: r.message });
    },
    [sel],
  );

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.4}>
        Your interests
      </Text>
      <View style={styles.iconBtn} />
    </View>
  );

  if (load.kind !== 'ready' || !sel || !saved) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          {load.kind === 'loading' ? (
            <ActivityIndicator color={obColors.cta} accessibilityLabel="Loading" />
          ) : (
            <>
              <Text style={styles.body} accessibilityLiveRegion="polite">{'message' in load ? load.message : ''}</Text>
              {load.kind === 'error' ? (
                <TouchableOpacity onPress={() => setReload((n) => n + 1)} accessibilityRole="button" hitSlop={10}>
                  <Text style={styles.link}>Try again</Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}
        </View>
      </View>
    );
  }

  const taste = (kind: TasteKind, title: string, key: 'artists' | 'books' | 'screen', search: SearchFn, attribution: string) => {
    const items = sel[key];
    return (
      <View style={styles.block}>
        <Text style={styles.subSection} accessibilityRole="header">{`${title} · ${items.length} of ${MAX_TASTE}`}</Text>
        <Typeahead
          kind={kind}
          label={title}
          hideLabel
          placeholder={`Search ${title.toLowerCase()}`}
          search={search}
          pickedIds={items.map((i) => i.id)}
          full={items.length >= MAX_TASTE}
          fullMessage={`You've added ${MAX_TASTE}. Remove one to add another.`}
          attribution={attribution}
          onPick={(it: TasteItem) => {
            const r = addTaste(items, it);
            if (!r.rejected) setSel((s) => (s ? { ...s, [key]: r.list } : s));
          }}
        />
        <SelectedList items={items} onRemove={(id) => setSel((s) => (s ? { ...s, [key]: removeTaste(s[key], id) } : s))} />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + obSpacing.xl }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        {banner ? (
          <View style={[styles.banner, banner.kind === 'error' && styles.bannerError]} accessibilityLiveRegion="polite" accessibilityRole={banner.kind === 'error' ? 'alert' : undefined}>
            <Ionicons name={banner.kind === 'ok' ? 'checkmark-circle' : 'alert-circle-outline'} size={20} color={banner.kind === 'ok' ? obColors.cta : obColors.error} />
            <Text style={styles.bannerText}>{banner.text}</Text>
            <TouchableOpacity onPress={() => setBanner(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dismiss">
              <Ionicons name="close" size={18} color={obColors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : null}

        <TakesEditor
          takes={takes}
          options={options}
          onTakesChange={(t) => setSaved((prev) => (prev ? { ...prev, takes: t } : prev))}
          // Say exactly what was saved (a starter is saved only by its own Save).
          onNotice={(n) =>
            setBanner(n ? { kind: n.kind, text: n.kind === 'ok' ? (n.text === 'Removed' ? 'Conversation starter removed' : 'Conversation starter saved') : n.text } : null)
          }
          onDirtyChange={setTakeDirty}
          noSubjectHint="To add one, save an activity, book, film or artist below first."
        />

        <Text style={[styles.section, styles.sectionGap]} accessibilityRole="header">Interests</Text>
        <InterestsFields draft={world} update={(p) => p.interests && setSel((s) => (s ? { ...s, interests: p.interests! } : s))} />
        <ActivitiesField value={sel.activities} onChange={(activities) => setSel((s) => (s ? { ...s, activities } : s))} />
        {taste('artist', 'Artists', 'artists', searchArtists, LIVE_ATTRIBUTION.artist)}
        {taste('book', 'Books', 'books', searchBooks, LIVE_ATTRIBUTION.book)}
        {taste('screen', 'Movies & series', 'screen', searchScreen, LIVE_ATTRIBUTION.screen)}

        {willRemove.length > 0 ? (
          <Text style={styles.warn} accessibilityLiveRegion="polite">
            {`Saving will also remove your answer about ${willRemove.map((t) => t.subject_title).join(', ')}.`}
          </Text>
        ) : null}
        {takeDirty ? (
          // This button never saves a conversation starter; an open, unsaved
          // starter must be saved (or cancelled) with its own buttons first.
          <Text style={styles.warn} accessibilityLiveRegion="polite">
            Your conversation starter isn’t saved yet. Use Save under it (or Cancel) first.
          </Text>
        ) : null}
        <OnboardingPrimaryButton
          label={savingSel ? 'Saving…' : 'Save interests'}
          onPress={() => void doSaveSelections(false)}
          disabled={savingSel || !selDirty || !selValid || takeDirty}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: obSpacing.sm, minHeight: 52, backgroundColor: obColors.background },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: obFonts.heading, fontSize: 22, lineHeight: 29, color: obColors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: obSpacing.md, padding: obSpacing.gutter },
  body: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textPrimary, textAlign: 'center' },
  link: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.cta, textDecorationLine: 'underline' },
  content: { padding: obSpacing.gutter, gap: obSpacing.md },
  section: { fontFamily: obFonts.heading, fontSize: 21, lineHeight: 28, color: obColors.textPrimary },
  sectionGap: { marginTop: obSpacing.lg },
  subSection: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  block: { gap: obSpacing.sm, marginTop: obSpacing.sm },
  warn: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 20, color: obColors.error },
  banner: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm, padding: obSpacing.md, borderRadius: 12, backgroundColor: obColors.selectedFill },
  bannerError: { backgroundColor: obColors.notice },
  bannerText: { flex: 1, fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
});
