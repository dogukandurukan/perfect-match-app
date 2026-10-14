// "Interests & conversation starter" (D87–D93) — the ONLY profile editing an
// approved V2 member has: broad interests, activities, books, movies/series,
// artists and the one personal answer. Identity, photos, standard prompts and
// every other application field stay locked (server: v2_assert_editable is
// untouched; these narrow operations change nothing else).
//
// Two independent saves, each server-first (nothing looks saved until the
// server said so; a failure keeps the draft):
//   • selections → save_interests_v2. Removing the take's subject is refused
//     by the server until the user confirms; then both change together.
//   • take → save_take_v2 / delete_take_v2, only about a SAVED selection.
//     Another subject never inherits the old answer.
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

import { TakeCard } from '@/components/interests/TakeCard';
import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { ArtistsFields, InterestsFields, MediaFields } from '@/components/onboarding-v2/yourWorld/YourWorldFields';
import { deleteTake, loadMyInterests, saveSelections, saveTake, type MyInterests } from '@/lib/interests/interestsV2';
import {
  ACTIVITIES,
  MAX_ACTIVITIES,
  TAKE_KIND_LABEL,
  TAKE_MAX,
  TAKE_QUESTIONS,
  chooseQuestion,
  chooseSubject,
  draftFromTake,
  removesTakeSubject,
  selectionsEqual,
  setAnswer,
  subjectOptions,
  takeDraftChanged,
  takeDraftValid,
  takeQuestionText,
  toggleActivity,
  type Selections,
  type TakeDraft,
} from '@/lib/interests/takes';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { EMPTY_WORLD_DRAFT, MAX_INTERESTS, MIN_INTERESTS, type WorldDraft } from '@/lib/onboardingV2/yourWorld';

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'unavailable'; message: string } | { kind: 'ready' };
type Banner = { kind: 'ok' | 'error'; text: string } | null;

const pick = (m: MyInterests): Selections => ({
  interests: m.interests,
  activities: m.activities,
  artists: m.artists,
  books: m.books,
  screen: m.screen,
});

export default function EditInterestsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [saved, setSaved] = useState<MyInterests | null>(null);
  const [sel, setSel] = useState<Selections | null>(null);
  const [savingSel, setSavingSel] = useState(false);
  const [takeDraft, setTakeDraft] = useState<TakeDraft | null>(null); // null = editor closed
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
      setTakeDraft(null);
      setLoad({ kind: 'ready' });
    })();
    return () => {
      live = false;
    };
  }, [reload]);

  const selDirty = !!saved && !!sel && !selectionsEqual(sel, pick(saved));
  const takeDirty = !!saved && !!takeDraft && takeDraftChanged(takeDraft, saved.take);
  const options = useMemo(() => (saved ? subjectOptions(pick(saved)) : []), [saved]);
  const willRemoveTake = !!saved && !!sel && removesTakeSubject(sel, saved.take);
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

  const world: WorldDraft = sel ? { ...EMPTY_WORLD_DRAFT, interests: sel.interests, artists: sel.artists, books: sel.books, screen: sel.screen } : EMPTY_WORLD_DRAFT;
  const updateWorld = (patch: Partial<WorldDraft>) =>
    setSel((s) => (s ? { ...s, ...('interests' in patch ? { interests: patch.interests! } : {}), ...('artists' in patch ? { artists: patch.artists! } : {}), ...('books' in patch ? { books: patch.books! } : {}), ...('screen' in patch ? { screen: patch.screen! } : {}) } : s));

  const applySaved = (m: MyInterests) => {
    setSaved(m);
    setSel(pick(m));
  };

  const doSaveSelections = useCallback(
    async (removeTake: boolean) => {
      if (!sel || busy.current) return;
      busy.current = true;
      setSavingSel(true);
      setBanner(null);
      const r = await saveSelections(sel, removeTake);
      busy.current = false;
      setSavingSel(false);
      if (r.kind === 'ok') {
        applySaved(r.value);
        if (r.takeRemoved) setTakeDraft(null);
        return setBanner({ kind: 'ok', text: r.takeRemoved ? 'Profile updated. Your conversation starter was removed.' : 'Profile updated' });
      }
      if (r.kind === 'confirm') {
        return Alert.alert(
          `Remove ${r.take.subject_title}?`,
          `Your conversation starter is about ${r.take.subject_title}. Removing it from your interests also removes that answer.`,
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setBanner({ kind: 'error', text: 'Not saved. Your interests and conversation starter are unchanged.' }) },
            { text: 'Remove both', style: 'destructive', onPress: () => void doSaveSelections(true) },
          ],
        );
      }
      setBanner({ kind: 'error', text: r.message });
    },
    [sel],
  );

  const doSaveTake = async () => {
    if (!takeDraft || !takeDraft.subject || !takeDraft.questionId || !takeDraftValid(takeDraft) || busy.current) return;
    busy.current = true;
    setSavingTake(true);
    setBanner(null);
    const r = await saveTake(takeDraft.subject.kind, takeDraft.subject.id, takeDraft.questionId, takeDraft.answer);
    busy.current = false;
    setSavingTake(false);
    if (r.kind === 'ok' && saved) {
      setSaved({ ...saved, take: r.take });
      setTakeDraft(null);
      return setBanner({ kind: 'ok', text: 'Profile updated' });
    }
    if (r.kind === 'error') setBanner({ kind: 'error', text: r.message });
  };

  const doDeleteTake = () =>
    Alert.alert('Remove your answer?', 'Only the conversation starter is removed. Your interests stay as they are.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove answer',
        style: 'destructive',
        onPress: async () => {
          if (busy.current) return;
          busy.current = true;
          setSavingTake(true);
          setBanner(null);
          const r = await deleteTake();
          busy.current = false;
          setSavingTake(false);
          if (r.kind === 'ok' && saved) {
            setSaved({ ...saved, take: null });
            setTakeDraft(null);
            return setBanner({ kind: 'ok', text: 'Profile updated' });
          }
          if (r.kind === 'error') setBanner({ kind: 'error', text: r.message });
        },
      },
    ]);

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={2} maxFontSizeMultiplier={1.4}>
        Interests & conversation starter
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

  const shownTake = saved.take
    ? { kind: saved.take.subject_kind, subjectTitle: saved.take.subject_title, questionId: saved.take.question_id, answer: saved.take.answer }
    : null;

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + obSpacing.xl }]} keyboardShouldPersistTaps="handled">
        {banner ? (
          <View style={[styles.banner, banner.kind === 'error' && styles.bannerError]} accessibilityLiveRegion="polite" accessibilityRole={banner.kind === 'error' ? 'alert' : undefined}>
            <Ionicons name={banner.kind === 'ok' ? 'checkmark-circle' : 'alert-circle-outline'} size={20} color={banner.kind === 'ok' ? obColors.cta : obColors.error} />
            <Text style={styles.bannerText}>{banner.text}</Text>
            <TouchableOpacity onPress={() => setBanner(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Dismiss">
              <Ionicons name="close" size={18} color={obColors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* ── Conversation starter ── */}
        <Text style={styles.section} accessibilityRole="header">Your conversation starter</Text>
        {takeDraft ? (
          <View style={styles.editor}>
            <Text style={styles.label}>About</Text>
            {options.length === 0 ? (
              <Text style={styles.hint}>Add an activity, book, film or artist below and save it first.</Text>
            ) : (
              options.map((o) => {
                const on = !!takeDraft.subject && takeDraft.subject.kind === o.kind && takeDraft.subject.id === o.id;
                return (
                  <TouchableOpacity
                    key={`${o.kind}:${o.id}`}
                    onPress={() => setTakeDraft((d) => (d ? chooseSubject(d, o) : d))}
                    style={[styles.option, on && styles.optionOn]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}>
                    <Text style={styles.optionText} numberOfLines={2}>
                      {o.title}
                      <Text style={styles.optionKind}>{` · ${TAKE_KIND_LABEL[o.kind]}`}</Text>
                    </Text>
                    <Ionicons name={on ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={on ? obColors.cta : obColors.border} />
                  </TouchableOpacity>
                );
              })
            )}
            {takeDraft.subject ? (
              <>
                <Text style={styles.label}>Question</Text>
                <View style={styles.chips}>
                  {TAKE_QUESTIONS[takeDraft.subject.kind].map((q) => {
                    const on = takeDraft.questionId === q.id;
                    return (
                      <TouchableOpacity
                        key={q.id}
                        onPress={() => setTakeDraft((d) => (d ? chooseQuestion(d, q.id) : d))}
                        style={[styles.chip, on && styles.chipOn]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: on }}>
                        <Text style={styles.chipText}>{q.text}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TextInput
                  value={takeDraft.answer}
                  onChangeText={(t) => setTakeDraft((d) => (d ? setAnswer(d, t) : d))}
                  placeholder="Keep it light. One sentence is plenty."
                  placeholderTextColor={obColors.textSecondary}
                  multiline
                  maxLength={TAKE_MAX}
                  style={styles.input}
                  accessibilityLabel={takeQuestionText(takeDraft.questionId ?? '') ?? 'Your answer'}
                />
                <Text style={styles.counter}>{`${takeDraft.answer.length} / ${TAKE_MAX}`}</Text>
              </>
            ) : null}
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <OnboardingPrimaryButton label="Cancel" variant="outline" onPress={() => setTakeDraft(null)} disabled={savingTake} />
              </View>
              <View style={{ flex: 1 }}>
                <OnboardingPrimaryButton label={savingTake ? 'Saving…' : 'Save'} onPress={() => void doSaveTake()} disabled={savingTake || !takeDraftValid(takeDraft) || !takeDirty} />
              </View>
            </View>
          </View>
        ) : shownTake ? (
          <View style={styles.stack}>
            <TakeCard take={shownTake} />
            <View style={styles.row}>
              <TouchableOpacity onPress={() => setTakeDraft(draftFromTake(saved.take, options))} style={styles.smallBtn} accessibilityRole="button" disabled={savingTake}>
                <Ionicons name="create-outline" size={18} color={obColors.textPrimary} />
                <Text style={styles.smallBtnText}>Edit answer</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setTakeDraft({ subject: null, questionId: null, answer: '' })} style={styles.smallBtn} accessibilityRole="button" disabled={savingTake}>
                <Ionicons name="swap-horizontal-outline" size={18} color={obColors.textPrimary} />
                <Text style={styles.smallBtnText}>Change interest</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={doDeleteTake} style={styles.remove} accessibilityRole="button" disabled={savingTake}>
              {savingTake ? <ActivityIndicator color={obColors.error} /> : <Ionicons name="trash-outline" size={18} color={obColors.error} />}
              <Text style={styles.removeText}>Remove answer</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.stack}>
            <Text style={styles.hint}>One small detail about an activity, book, film or artist you love. Optional.</Text>
            <OnboardingPrimaryButton
              label="Add a conversation starter"
              variant="outline"
              disabled={options.length === 0}
              onPress={() => setTakeDraft({ subject: null, questionId: null, answer: '' })}
            />
            {options.length === 0 ? <Text style={styles.hint}>Add an activity, book, film or artist below and save it first.</Text> : null}
          </View>
        )}

        {/* ── Selections ── */}
        <Text style={styles.section} accessibilityRole="header">Your interests</Text>
        <InterestsFields draft={world} update={updateWorld} />
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
        <Text style={styles.subSection} accessibilityRole="header">Artists</Text>
        <ArtistsFields draft={world} update={updateWorld} />
        <MediaFields draft={world} update={updateWorld} />

        {willRemoveTake ? (
          <Text style={styles.warn} accessibilityLiveRegion="polite">
            {`Saving will also remove your conversation starter about ${saved.take?.subject_title}.`}
          </Text>
        ) : null}
        <OnboardingPrimaryButton
          label={savingSel ? 'Saving…' : 'Save interests'}
          onPress={() => void doSaveSelections(false)}
          disabled={savingSel || !selDirty || !selValid}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: obColors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: obSpacing.sm, minHeight: 52 },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontFamily: obFonts.heading, fontSize: 20, lineHeight: 26, color: obColors.textPrimary },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: obSpacing.md, padding: obSpacing.gutter },
  body: { fontFamily: obFonts.body, fontSize: 16, lineHeight: 22, color: obColors.textPrimary, textAlign: 'center' },
  link: { fontFamily: obFonts.bodySemiBold, fontSize: 16, lineHeight: 22, color: obColors.cta, textDecorationLine: 'underline' },
  content: { padding: obSpacing.gutter, gap: obSpacing.md },
  section: { marginTop: obSpacing.md, fontFamily: obFonts.heading, fontSize: 22, lineHeight: 29, color: obColors.textPrimary },
  subSection: { marginTop: obSpacing.sm, fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  stack: { gap: obSpacing.md },
  hint: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary },
  warn: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 20, color: obColors.error },
  banner: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.sm, padding: obSpacing.md, borderRadius: 12, backgroundColor: obColors.selectedFill },
  bannerError: { backgroundColor: obColors.notice },
  bannerText: { flex: 1, fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  editor: { gap: obSpacing.sm, padding: obSpacing.lg, borderRadius: 16, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#E4DCCB' },
  label: { fontFamily: obFonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: obColors.textSecondary, marginTop: obSpacing.xs },
  option: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md, minHeight: 48, paddingHorizontal: obSpacing.md, borderRadius: 12, borderWidth: 1, borderColor: '#E4DCCB' },
  optionOn: { backgroundColor: obColors.selectedFill, borderColor: obColors.cta },
  optionText: { flex: 1, fontFamily: obFonts.bodyMedium, fontSize: 16, lineHeight: 21, color: obColors.textPrimary },
  optionKind: { fontFamily: obFonts.body, color: obColors.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: obSpacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: obSpacing.md, borderRadius: 999, borderWidth: 1, borderColor: obColors.border, backgroundColor: '#FFFDF8' },
  chipOn: { backgroundColor: obColors.selectedFill, borderColor: obColors.cta },
  chipText: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  input: {
    minHeight: 96,
    paddingHorizontal: obSpacing.md,
    paddingTop: obSpacing.md,
    paddingBottom: obSpacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: obColors.border,
    backgroundColor: obColors.background,
    fontFamily: obFonts.body,
    fontSize: 17,
    color: obColors.textPrimary,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  row: { flexDirection: 'row', gap: obSpacing.sm },
  smallBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: obColors.border, backgroundColor: '#FFFDF8' },
  smallBtnText: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  remove: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, paddingHorizontal: obSpacing.md },
  removeText: { fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.error },
});
