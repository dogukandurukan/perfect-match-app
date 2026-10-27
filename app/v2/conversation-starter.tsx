// One conversation starter (2026-10-27): add (`mode=new`), edit the answer
// (`mode=edit&id=`) or change its topic (`mode=change&id=`). Topic, question
// and answer, with ONE Save that saves only this starter (save_take_v2: a new
// one never overwrites another; edit keeps the id; another topic gets a new
// id and nothing is carried over — unchanged server rules).
//   • Save is off while nothing changed or the answer isn't valid;
//   • "Saved" only after the server said so: the keyboard closes and the
//     list (which re-reads the server on focus) shows the new answer;
//   • a failure keeps the draft and shows the error;
//   • leaving with unsaved changes asks "Discard changes?".
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { loadMyInterests, saveTake } from '@/lib/interests/interestsV2';
import {
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
  setAnswer,
  subjectOptions,
  takeDraftChanged,
  takeDraftValid,
  type Subject,
  type Take,
  type TakeDraft,
} from '@/lib/interests/takes';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import { setScreenNotice } from '@/lib/profile/screenNotice';

type Load = { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'ready'; takes: Take[]; options: Subject[] };

export default function ConversationStarterScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { mode, id } = useLocalSearchParams<{ mode?: string; id?: string }>();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  const [reload, setReload] = useState(0);
  const [draft, setDraft] = useState<TakeDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const leaving = useRef(false);
  const takes = load.kind === 'ready' ? load.takes : [];
  const options = load.kind === 'ready' ? load.options : [];
  const dirty = !!draft && takeDraftChanged(draft, takes);
  const valid = !!draft && takeDraftValid(draft);

  useEffect(() => {
    let live = true;
    void (async () => {
      setLoad({ kind: 'loading' });
      const r = await loadMyInterests();
      if (!live) return;
      if (r.kind !== 'ok') return setLoad({ kind: 'error', message: r.kind === 'error' ? r.message : 'Conversation starters aren’t available on this server yet.' });
      if (!r.value.editable) return setLoad({ kind: 'error', message: 'Your account can’t edit this right now.' });
      const list = orderedTakes(r.value.takes);
      const opts = subjectOptions(r.value);
      const t = id ? list.find((x) => x.id === id) ?? null : null;
      if (mode === 'new') {
        if (!canAddTake(list, opts)) return setLoad({ kind: 'error', message: 'You can’t add another one right now.' });
        setDraft(newTakeDraft());
      } else if (t) {
        setDraft(mode === 'change' ? changeSubjectDraft(t) : editTakeDraft(t, opts));
      } else {
        return setLoad({ kind: 'error', message: 'This conversation starter isn’t there any more.' });
      }
      setLoad({ kind: 'ready', takes: list, options: opts });
    })();
    return () => {
      live = false;
    };
  }, [mode, id, reload]);

  // Leaving with unsaved changes asks first (nothing is saved silently).
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove', (e: { preventDefault: () => void; data: { action: unknown } }) => {
      if (!dirty || leaving.current || busy.current) return;
      e.preventDefault();
      Alert.alert('Discard changes?', 'Your changes haven’t been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action as never) },
      ]);
    });
    return unsub;
  }, [navigation, dirty]);

  const save = async () => {
    if (!draft || !draft.subject || !draft.questionId || !valid || !dirty || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    const r = await saveTake(draft.takeId, draft.subject.kind, draft.subject.id, draft.questionId, draft.answer);
    busy.current = false;
    setSaving(false);
    if (r.kind === 'error') return setError(r.message); // the draft stays for a retry
    Keyboard.dismiss();
    setScreenNotice('Conversation starter saved');
    leaving.current = true;
    router.back(); // the list re-reads the server copy on focus
  };

  const header = (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.iconBtn}>
        <Ionicons name="chevron-back" size={24} color={obColors.textPrimary} />
      </TouchableOpacity>
      <Text style={styles.title} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.4}>
        {mode === 'new' ? 'New starter' : 'Conversation starter'}
      </Text>
      <View style={styles.iconBtn} />
    </View>
  );

  if (load.kind !== 'ready' || !draft) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        {header}
        <View style={styles.center}>
          {load.kind === 'error' ? (
            <>
              <Text style={styles.body}>{load.message}</Text>
              <OnboardingPrimaryButton label="Try again" variant="outline" onPress={() => setReload((n) => n + 1)} />
            </>
          ) : (
            <ActivityIndicator color={obColors.cta} accessibilityLabel="Loading" />
          )}
        </View>
      </View>
    );
  }

  const free = freeSubjects(options, takes, draft.takeId);
  const edit = (fn: (d: TakeDraft) => TakeDraft) => {
    setError(null);
    setDraft((d) => (d ? fn(d) : d));
  };

  return (
    <KeyboardAvoidingView style={[styles.root, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: obSpacing.xxl }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <Text style={styles.label} accessibilityRole="header">Topic</Text>
        {draft.choosing || !draft.subject ? (
          <View style={styles.list}>
            {free.length === 0 ? (
              <Text style={styles.hint}>To add one, save an activity, book, film or artist in Your interests first.</Text>
            ) : null}
            {free.map((o) => (
              <TouchableOpacity key={`${o.kind}:${o.id}`} onPress={() => edit((d) => chooseSubject(d, o))} style={styles.option} accessibilityRole="button">
                <Text style={styles.optionText} numberOfLines={2}>
                  {o.title}
                  <Text style={styles.optionKind}>{` · ${TAKE_KIND_LABEL[o.kind]}`}</Text>
                </Text>
                <Ionicons name="chevron-forward" size={18} color={obColors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <>
            <View style={styles.subjectRow}>
              <Text style={styles.subjectText} numberOfLines={2}>
                {draft.subject.title}
                <Text style={styles.optionKind}>{` · ${TAKE_KIND_LABEL[draft.subject.kind]}`}</Text>
              </Text>
              <TouchableOpacity onPress={() => edit((d) => ({ ...d, choosing: true }))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Choose another topic">
                <Text style={styles.link}>Change</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.label} accessibilityRole="header">Question</Text>
            <View style={styles.chips}>
              {questionsFor(draft.subject).map((q) => {
                const on = draft.questionId === q.id;
                return (
                  <TouchableOpacity key={q.id} onPress={() => edit((d) => chooseQuestion(d, q.id))} style={[styles.chip, on && styles.chipOn]} accessibilityRole="radio" accessibilityState={{ checked: on }}>
                    <Text style={styles.chipText}>{q.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.label} accessibilityRole="header">Your answer</Text>
            <TextInput
              value={draft.answer}
              onChangeText={(t) => edit((d) => setAnswer(d, t))}
              placeholder="Keep it light. One sentence is plenty."
              placeholderTextColor={obColors.textSecondary}
              multiline
              maxLength={TAKE_MAX}
              style={styles.input}
              accessibilityLabel="Your answer"
            />
            <Text style={styles.counter}>{`${draft.answer.length} / ${TAKE_MAX}`}</Text>
          </>
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, obSpacing.md) }]}>
        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <OnboardingPrimaryButton label={saving ? 'Saving…' : 'Save'} onPress={() => void save()} disabled={saving || !valid || !dirty} />
      </View>
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
  content: { padding: obSpacing.gutter, gap: obSpacing.md },
  label: { fontFamily: obFonts.bodySemiBold, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  hint: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary },
  link: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.cta, textDecorationLine: 'underline' },
  list: { gap: obSpacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md, minHeight: 46, paddingHorizontal: obSpacing.md, borderRadius: 12, borderWidth: 1, borderColor: '#E4DCCB', backgroundColor: '#FFFDF8' },
  optionText: { flex: 1, fontFamily: obFonts.bodyMedium, fontSize: 15, lineHeight: 20, color: obColors.textPrimary },
  optionKind: { fontFamily: obFonts.body, color: obColors.textSecondary },
  subjectRow: { flexDirection: 'row', alignItems: 'center', gap: obSpacing.md },
  subjectText: { flex: 1, fontFamily: obFonts.bodyMedium, fontSize: 16, lineHeight: 21, color: obColors.cta },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: obSpacing.sm },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: obSpacing.md, borderRadius: 999, borderWidth: 1, borderColor: obColors.border, backgroundColor: '#FFFDF8' },
  chipOn: { backgroundColor: obColors.selectedFill, borderColor: obColors.cta },
  chipText: { fontFamily: obFonts.bodyMedium, fontSize: 14, lineHeight: 19, color: obColors.textPrimary },
  input: {
    minHeight: 110,
    paddingHorizontal: obSpacing.md,
    paddingTop: obSpacing.md,
    paddingBottom: obSpacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: obColors.border,
    backgroundColor: '#FFFDF8',
    fontFamily: obFonts.body,
    fontSize: 16,
    color: obColors.textPrimary,
    textAlignVertical: 'top',
  },
  counter: { alignSelf: 'flex-end', fontFamily: obFonts.body, fontSize: 13, lineHeight: 18, color: obColors.textSecondary },
  footer: { paddingHorizontal: obSpacing.gutter, paddingTop: obSpacing.sm, gap: obSpacing.sm, backgroundColor: obColors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E4DCCB' },
  error: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.error, textAlign: 'center' },
});
