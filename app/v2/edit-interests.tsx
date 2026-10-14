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
//   • a starter → save_take_v2 (new: never overwrites another; edit: same id;
//     another subject: new id, nothing carried over) / delete_take_v2.
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TakeRow } from '@/components/interests/TakeCard';
import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { SelectedList, Typeahead } from '@/components/onboarding-v2/yourWorld/Typeahead';
import { InterestsFields } from '@/components/onboarding-v2/yourWorld/YourWorldFields';
import { deleteTake, loadMyInterests, saveSelections, saveTake, type MyInterests } from '@/lib/interests/interestsV2';
import {
  ACTIVITIES,
  MAX_ACTIVITIES,
  MAX_TAKES,
  TAKE_KIND_LABEL,
  TAKE_MAX,
  canAddTake,
  changeSubjectDraft,
  chooseQuestion,
  chooseSubject,
  editTakeDraft,
  freeSubjects,
  newTakeDraft,
  orderedTakes,
  questionsFor,
  selectionsEqual,
  setAnswer,
  subjectOptions,
  takeDraftChanged,
  takeDraftValid,
  takesRemovedBy,
  toggleActivity,
  type Selections,
  type Take,
  type TakeDraft,
} from '@/lib/interests/takes';
import { LIVE_ATTRIBUTION } from '@/lib/onboardingV2/liveCatalog';
import { searchArtists, searchBooks, searchScreen, type SearchFn } from '@/lib/onboardingV2/tasteSearch';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import type { PublicTake } from '@/lib/onboardingV2/yourProfile';
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
const shown = (t: Take): PublicTake => ({ kind: t.subject_kind, subjectId: t.subject_id, subjectTitle: t.subject_title, questionId: t.question_id, answer: t.answer });

export default function EditInterestsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [saved, setSaved] = useState<MyInterests | null>(null);
  const [sel, setSel] = useState<Selections | null>(null);
  const [savingSel, setSavingSel] = useState(false);
  const [draft, setDraft] = useState<TakeDraft | null>(null); // one editor at a time
  const [savingTake, setSavingTake] = useState(false);
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
      setDraft(null);
      setLoad({ kind: 'ready' });
    })();
    return () => {
      live = false;
    };
  }, [reload]);

  const takes = useMemo(() => (saved ? orderedTakes(saved.takes) : []), [saved]);
  const options = useMemo(() => (saved ? subjectOptions(pick(saved)) : []), [saved]);
  const selDirty = !!saved && !!sel && !selectionsEqual(sel, pick(saved));
  const takeDirty = !!draft && takeDraftChanged(draft, takes);
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

  /** Opening another editor never silently drops typed text. */
  const openEditor = (next: TakeDraft) => {
    if (!takeDirty) return setDraft(next);
    Alert.alert('Discard this answer?', 'Your unsaved text will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => setDraft(next) },
    ]);
  };

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
        if (draft?.takeId && !r.value.takes.some((t) => t.id === draft.takeId)) setDraft(null);
        return setBanner({
          kind: 'ok',
          text: r.takesRemoved > 0 ? `Profile updated. ${r.takesRemoved === 1 ? '1 conversation starter was' : `${r.takesRemoved} conversation starters were`} removed.` : 'Profile updated',
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
    [sel, draft],
  );

  const doSaveTake = async () => {
    if (!draft || !draft.subject || !draft.questionId || !takeDraftValid(draft) || busy.current || !saved) return;
    busy.current = true;
    setSavingTake(true);
    setBanner(null);
    const r = await saveTake(draft.takeId, draft.subject.kind, draft.subject.id, draft.questionId, draft.answer);
    busy.current = false;
    setSavingTake(false);
    if (r.kind === 'error') return setBanner({ kind: 'error', text: r.message });
    // Fresh server copy (positions / ids exactly as stored).
    const fresh = await loadMyInterests();
    if (fresh.kind === 'ok') setSaved((prev) => (prev ? { ...prev, takes: fresh.value.takes } : prev));
    else if (r.take) setSaved((prev) => (prev ? { ...prev, takes: orderedTakes([...prev.takes.filter((t) => t.id !== draft.takeId), r.take!]) } : prev));
    setDraft(null);
    setBanner({ kind: 'ok', text: 'Profile updated' });
  };

  const doDeleteTake = (t: Take) =>
    Alert.alert('Remove this answer?', `Only your answer about ${t.subject_title} is removed. Your interests and other answers stay.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove answer',
        style: 'destructive',
        onPress: async () => {
          if (busy.current) return;
          busy.current = true;
          setSavingTake(true);
          setBanner(null);
          const r = await deleteTake(t.id);
          busy.current = false;
          setSavingTake(false);
          if (r.kind === 'error') return setBanner({ kind: 'error', text: r.message });
          setSaved((prev) => (prev ? { ...prev, takes: prev.takes.filter((x) => x.id !== t.id) } : prev));
          if (draft?.takeId === t.id) setDraft(null);
          setBanner({ kind: 'ok', text: 'Profile updated' });
        },
      },
    ]);

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

  const editor = (d: TakeDraft) => {
    const free = freeSubjects(options, takes, d.takeId);
    return (
      <View style={styles.editor} key={`editor-${d.takeId ?? 'new'}`}>
        {d.choosing || !d.subject ? (
          <>
            <Text style={styles.label}>Choose what it’s about</Text>
            {free.length === 0 ? <Text style={styles.hint}>Save an activity, book, film or artist below first.</Text> : null}
            {free.map((o) => (
              <TouchableOpacity key={`${o.kind}:${o.id}`} onPress={() => setDraft((x) => (x ? chooseSubject(x, o) : x))} style={styles.option} accessibilityRole="button">
                <Text style={styles.optionText} numberOfLines={2}>
                  {o.title}
                  <Text style={styles.optionKind}>{` · ${TAKE_KIND_LABEL[o.kind]}`}</Text>
                </Text>
                <Ionicons name="chevron-forward" size={18} color={obColors.textSecondary} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setDraft(null)} style={styles.textBtn} accessibilityRole="button">
              <Text style={styles.textBtnText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.subjectRow}>
              <Text style={styles.subjectText} numberOfLines={2}>
                {d.subject.title}
                <Text style={styles.optionKind}>{` · ${TAKE_KIND_LABEL[d.subject.kind]}`}</Text>
              </Text>
              <TouchableOpacity onPress={() => setDraft((x) => (x ? { ...x, choosing: true } : x))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Choose another interest">
                <Text style={styles.link}>Change</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.chips}>
              {questionsFor(d.subject).map((q) => {
                const on = d.questionId === q.id;
                return (
                  <TouchableOpacity key={q.id} onPress={() => setDraft((x) => (x ? chooseQuestion(x, q.id) : x))} style={[styles.chip, on && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                    <Text style={styles.chipText}>{q.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              value={d.answer}
              onChangeText={(t) => setDraft((x) => (x ? setAnswer(x, t) : x))}
              placeholder="Keep it light. One sentence is plenty."
              placeholderTextColor={obColors.textSecondary}
              multiline
              maxLength={TAKE_MAX}
              style={styles.input}
              accessibilityLabel="Your answer"
            />
            <Text style={styles.counter}>{`${d.answer.length} / ${TAKE_MAX}`}</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <OnboardingPrimaryButton label="Cancel" variant="outline" onPress={() => setDraft(null)} disabled={savingTake} />
              </View>
              <View style={{ flex: 1 }}>
                <OnboardingPrimaryButton label={savingTake ? 'Saving…' : 'Save'} onPress={() => void doSaveTake()} disabled={savingTake || !takeDraftValid(d) || !takeDirty} />
              </View>
            </View>
          </>
        )}
      </View>
    );
  };

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

        {/* ── Conversation starters ── */}
        <View style={styles.sectionHead}>
          <Text style={styles.section} accessibilityRole="header">Conversation starters</Text>
          <Text style={styles.count}>{`${takes.length} of ${MAX_TAKES}`}</Text>
        </View>
        {takes.map((t) =>
          draft?.takeId === t.id ? (
            editor(draft)
          ) : (
            <View key={t.id} style={styles.takeCard}>
              <TakeRow take={shown(t)} />
              <View style={styles.actions}>
                <TouchableOpacity onPress={() => openEditor(editTakeDraft(t, options))} style={styles.action} accessibilityRole="button" accessibilityLabel={`Edit answer about ${t.subject_title}`} disabled={savingTake}>
                  <Ionicons name="create-outline" size={17} color={obColors.textPrimary} />
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openEditor(changeSubjectDraft(t))} style={styles.action} accessibilityRole="button" accessibilityLabel={`Change interest for the answer about ${t.subject_title}`} disabled={savingTake}>
                  <Ionicons name="swap-horizontal-outline" size={17} color={obColors.textPrimary} />
                  <Text style={styles.actionText}>Change</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => doDeleteTake(t)} style={styles.action} accessibilityRole="button" accessibilityLabel={`Remove answer about ${t.subject_title}`} disabled={savingTake}>
                  <Ionicons name="trash-outline" size={17} color={obColors.error} />
                  <Text style={[styles.actionText, { color: obColors.error }]}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          ),
        )}
        {draft && draft.takeId === null ? editor(draft) : null}
        {takes.length === 0 && !draft ? <Text style={styles.hint}>Optional. A small detail about an activity, book, film or artist you love.</Text> : null}
        {!draft && takes.length < MAX_TAKES ? (
          canAddTake(takes, options) ? (
            <TouchableOpacity onPress={() => openEditor(newTakeDraft())} style={styles.add} accessibilityRole="button">
              <Ionicons name="add" size={20} color={obColors.cta} />
              <Text style={styles.addText}>Add a conversation starter</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.hint}>To add one, save an activity, book, film or artist below first.</Text>
          )
        ) : null}

        {/* ── Interests ── */}
        <Text style={[styles.section, styles.sectionGap]} accessibilityRole="header">Interests</Text>
        <InterestsFields draft={world} update={(p) => p.interests && setSel((s) => (s ? { ...s, interests: p.interests! } : s))} />
        <View style={styles.block}>
          <Text style={styles.subSection} accessibilityRole="header">{`Activities · ${sel.activities.length} of ${MAX_ACTIVITIES}`}</Text>
          <View style={styles.chips}>
            {ACTIVITIES.map((a) => {
              const on = sel.activities.includes(a.key);
              const blocked = !on && sel.activities.length >= MAX_ACTIVITIES;
              return (
                <TouchableOpacity
                  key={a.key}
                  onPress={() => setSel((s) => (s ? { ...s, activities: toggleActivity(s.activities, a.key) } : s))}
                  disabled={blocked}
                  style={[styles.chip, on && styles.chipOn, blocked && { opacity: 0.45 }]}
                  accessibilityRole="checkbox"
                  accessibilityLabel={a.label}
                  accessibilityState={{ checked: on, disabled: blocked }}>
                  <Ionicons name={a.icon as keyof typeof Ionicons.glyphMap} size={16} color={obColors.cta} importantForAccessibility="no" />
                  <Text style={styles.chipText}>{a.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
        {taste('artist', 'Artists', 'artists', searchArtists, LIVE_ATTRIBUTION.artist)}
        {taste('book', 'Books', 'books', searchBooks, LIVE_ATTRIBUTION.book)}
        {taste('screen', 'Movies & series', 'screen', searchScreen, LIVE_ATTRIBUTION.screen)}

        {willRemove.length > 0 ? (
          <Text style={styles.warn} accessibilityLiveRegion="polite">
            {`Saving will also remove your answer about ${willRemove.map((t) => t.subject_title).join(', ')}.`}
          </Text>
        ) : null}
        <OnboardingPrimaryButton label={savingSel ? 'Saving…' : 'Save interests'} onPress={() => void doSaveSelections(false)} disabled={savingSel || !selDirty || !selValid} />
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
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: obSpacing.md },
  section: { fontFamily: obFonts.heading, fontSize: 21, lineHeight: 28, color: obColors.textPrimary },
  sectionGap: { marginTop: obSpacing.lg },
  count: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  subSection: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  block: { gap: obSpacing.sm, marginTop: obSpacing.sm },
  hint: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary },
  warn: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 20, color: obColors.error },
  banner: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm, padding: obSpacing.md, borderRadius: 12, backgroundColor: obColors.selectedFill },
  bannerError: { backgroundColor: obColors.notice },
  bannerText: { flex: 1, fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  takeCard: { paddingHorizontal: obSpacing.lg, paddingTop: obSpacing.xs, paddingBottom: obSpacing.xs, borderRadius: 14, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E4DCCB' },
  actions: { flexDirection: 'row', gap: obSpacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4DCCB' },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 44 },
  actionText: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
  add: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: obSpacing.sm, minHeight: 48, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: obColors.border },
  addText: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.cta },
  editor: { gap: obSpacing.sm, padding: obSpacing.lg, borderRadius: 14, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: obColors.cta },
  label: { fontFamily: obFonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  option: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md, minHeight: 46, paddingHorizontal: obSpacing.md, borderRadius: 12, borderWidth: 1, borderColor: '#E4DCCB' },
  optionText: { flex: 1, fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  optionKind: { fontFamily: obFonts.body, color: obColors.textSecondary },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md },
  subjectText: { flex: 1, fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.cta },
  textBtn: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: obSpacing.md },
  textBtnText: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: obSpacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: obSpacing.md, borderRadius: 999, borderWidth: 1, borderColor: obColors.border, backgroundColor: '#FFFDF8' },
  chipOn: { backgroundColor: obColors.selectedFill, borderColor: obColors.cta },
  chipText: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
  input: {
    minHeight: 92,
    paddingHorizontal: obSpacing.md,
    paddingTop: obSpacing.md,
    paddingBottom: obSpacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: obColors.border,
    backgroundColor: obColors.background,
    fontFamily: obFonts.body,
    fontSize: 16,
    color: obColors.textPrimary,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  row: { flexDirection: 'row', gap: obSpacing.sm },
});
