// Conversation starters editor (D87–D97, D93): saved starters as compact cards
// (Edit / Change / Remove), one inline editor at a time, "Add a conversation
// starter" below three. Server-first: nothing looks saved until the server
// said so; a failure keeps the draft. Shared by Profile → Your interests and
// onboarding ("A little more you") — one answer system, the same server
// operations (save_take_v2 / delete_take_v2). Subjects = the member's SAVED
// selections only.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { TakeRow } from '@/components/interests/TakeCard';
import { OnboardingPrimaryButton } from '@/components/onboarding-v2/OnboardingPrimaryButton';
import { deleteTake, loadMyInterests, saveTake } from '@/lib/interests/interestsV2';
import {
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
  setAnswer,
  takeDraftChanged,
  takeDraftValid,
  type Subject,
  type Take,
  type TakeDraft,
} from '@/lib/interests/takes';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import type { PublicTake } from '@/lib/onboardingV2/yourProfile';

export const shownTake = (t: Take): PublicTake => ({ kind: t.subject_kind, subjectId: t.subject_id, subjectTitle: t.subject_title, questionId: t.question_id, answer: t.answer });

type Notice = { kind: 'ok' | 'error'; text: string };

export function TakesEditor({
  takes: unordered,
  options,
  onTakesChange,
  onNotice,
  onDirtyChange,
  emptyHint = 'Optional. A small detail about an activity, book, film or artist you love.',
  noSubjectHint = 'To add one, save an activity, book, film or artist first.',
}: {
  takes: Take[];
  /** Subjects from the member's SAVED selections. */
  options: Subject[];
  onTakesChange: (takes: Take[]) => void;
  onNotice: (n: Notice | null) => void;
  onDirtyChange?: (dirty: boolean) => void;
  emptyHint?: string;
  noSubjectHint?: string;
}) {
  const takes = orderedTakes(unordered);
  const [draft, setDraft] = useState<TakeDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const dirty = !!draft && takeDraftChanged(draft, takes);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  // A starter removed elsewhere (e.g. its subject was removed) closes its editor.
  useEffect(() => {
    if (draft?.takeId && !unordered.some((t) => t.id === draft.takeId)) setDraft(null);
  }, [unordered, draft]);

  /** Opening another editor never silently drops typed text. */
  const openEditor = (next: TakeDraft) => {
    if (!dirty) return setDraft(next);
    Alert.alert('Discard this answer?', 'Your unsaved text will be lost.', [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => setDraft(next) },
    ]);
  };

  const save = async () => {
    if (!draft || !draft.subject || !draft.questionId || !takeDraftValid(draft) || busy.current) return;
    busy.current = true;
    setSaving(true);
    onNotice(null);
    const r = await saveTake(draft.takeId, draft.subject.kind, draft.subject.id, draft.questionId, draft.answer);
    if (r.kind === 'error') {
      busy.current = false;
      setSaving(false);
      return onNotice({ kind: 'error', text: r.message });
    }
    // Fresh server copy (ids / positions exactly as stored).
    const fresh = await loadMyInterests();
    busy.current = false;
    setSaving(false);
    if (fresh.kind === 'ok') onTakesChange(fresh.value.takes);
    else if (r.take) onTakesChange(orderedTakes([...unordered.filter((t) => t.id !== draft.takeId), r.take]));
    setDraft(null);
    onNotice({ kind: 'ok', text: 'Saved' });
  };

  const remove = (t: Take) =>
    Alert.alert('Remove this answer?', `Only your answer about ${t.subject_title} is removed. Your interests and other answers stay.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove answer',
        style: 'destructive',
        onPress: async () => {
          if (busy.current) return;
          busy.current = true;
          setSaving(true);
          onNotice(null);
          const r = await deleteTake(t.id);
          busy.current = false;
          setSaving(false);
          if (r.kind === 'error') return onNotice({ kind: 'error', text: r.message });
          onTakesChange(unordered.filter((x) => x.id !== t.id));
          if (draft?.takeId === t.id) setDraft(null);
          onNotice({ kind: 'ok', text: 'Removed' });
        },
      },
    ]);

  const editor = (d: TakeDraft) => {
    const free = freeSubjects(options, takes, d.takeId);
    return (
      <View style={styles.editor} key={`editor-${d.takeId ?? 'new'}`}>
        {d.choosing || !d.subject ? (
          <>
            <Text style={styles.label}>Choose what it’s about</Text>
            {free.length === 0 ? <Text style={styles.hint}>{noSubjectHint}</Text> : null}
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
                <OnboardingPrimaryButton label="Cancel" variant="outline" onPress={() => setDraft(null)} disabled={saving} />
              </View>
              <View style={{ flex: 1 }}>
                <OnboardingPrimaryButton label={saving ? 'Saving…' : 'Save'} onPress={() => void save()} disabled={saving || !takeDraftValid(d) || !dirty} />
              </View>
            </View>
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.sectionHead}>
        <Text style={styles.section} accessibilityRole="header">Conversation starters</Text>
        <Text style={styles.count}>{`${takes.length} of ${MAX_TAKES}`}</Text>
      </View>
      {takes.map((t) =>
        draft?.takeId === t.id ? (
          editor(draft)
        ) : (
          <View key={t.id} style={styles.takeCard}>
            <TakeRow take={shownTake(t)} />
            <View style={styles.actions}>
              <TouchableOpacity onPress={() => openEditor(editTakeDraft(t, options))} style={styles.action} accessibilityRole="button" accessibilityLabel={`Edit answer about ${t.subject_title}`} disabled={saving}>
                <Ionicons name="create-outline" size={17} color={obColors.textPrimary} />
                <Text style={styles.actionText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openEditor(changeSubjectDraft(t))} style={styles.action} accessibilityRole="button" accessibilityLabel={`Change interest for the answer about ${t.subject_title}`} disabled={saving}>
                <Ionicons name="swap-horizontal-outline" size={17} color={obColors.textPrimary} />
                <Text style={styles.actionText}>Change</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => remove(t)} style={styles.action} accessibilityRole="button" accessibilityLabel={`Remove answer about ${t.subject_title}`} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color={obColors.error} /> : <Ionicons name="trash-outline" size={17} color={obColors.error} />}
                <Text style={[styles.actionText, { color: obColors.error }]}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ),
      )}
      {draft && draft.takeId === null ? editor(draft) : null}
      {takes.length === 0 && !draft ? <Text style={styles.hint}>{emptyHint}</Text> : null}
      {!draft && takes.length < MAX_TAKES ? (
        canAddTake(takes, options) ? (
          <TouchableOpacity onPress={() => openEditor(newTakeDraft())} style={styles.add} accessibilityRole="button">
            <Ionicons name="add" size={20} color={obColors.cta} />
            <Text style={styles.addText}>Add a conversation starter</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.hint}>{noSubjectHint}</Text>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: obSpacing.md },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: obSpacing.md },
  section: { fontFamily: obFonts.heading, fontSize: 21, lineHeight: 28, color: obColors.textPrimary },
  count: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 19, color: obColors.textSecondary },
  hint: { fontFamily: obFonts.body, fontSize: 14, lineHeight: 20, color: obColors.textSecondary },
  link: { fontFamily: obFonts.bodySemiBold, fontSize: 15, lineHeight: 20, color: obColors.cta, textDecorationLine: 'underline' },
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
