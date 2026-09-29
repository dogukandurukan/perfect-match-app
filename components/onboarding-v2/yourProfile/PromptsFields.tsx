// Section 7.2 A little more you (P07 R2, D60). Three cards: two required,
// one optional, all starting as "Choose a prompt". Picking happens in a wide,
// scrollable picker with categories; writing happens in a separate editor.
// Answers are stored exactly as typed (Turkish or English — no translation,
// no ASCII folding). Examples are placeholders only: never stored, never
// count, never shown on the profile. An answer is never silently dropped or
// silently re-attached to another prompt.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  FlatList,
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

import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import {
  PROMPT_CATEGORIES,
  promptById,
  promptsInCategory,
  type PromptCategory,
} from '@/lib/onboardingV2/promptCatalog';
import {
  ANSWER_HINT,
  ANSWER_MAX_LENGTH,
  REQUIRED_PROMPTS,
  answerFilled,
  clearSlot,
  saveSlot,
  usedPromptIds,
  type PromptAnswer,
} from '@/lib/onboardingV2/yourProfile';

type Props = {
  prompts: PromptAnswer[];
  updatePrompts: (fn: (list: PromptAnswer[]) => PromptAnswer[]) => void;
};

type Sheet =
  | { mode: 'picker'; slot: number; fromEditor: boolean }
  | { mode: 'editor'; slot: number };

type EditorDraft = { promptId: string; text: string; saved: string };

export function PromptsFields({ prompts, updatePrompts }: Props) {
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [category, setCategory] = useState<PromptCategory | 'all'>('all');
  const [exLang, setExLang] = useState<'en' | 'tr'>('en');
  const [exIndex, setExIndex] = useState(0);
  const [showTr, setShowTr] = useState(false);

  const answered = prompts.slice(0, REQUIRED_PROMPTS).filter(answerFilled).length;

  const openSlot = (slot: number) => {
    const a = prompts[slot];
    if (a && answerFilled(a)) {
      setDraft({ promptId: a.promptId as string, text: a.answer, saved: a.answer });
      setExIndex(0);
      setShowTr(false);
      setSheet({ mode: 'editor', slot });
    } else {
      setDraft(null);
      setSheet({ mode: 'picker', slot, fromEditor: false });
    }
  };

  const close = () => {
    setSheet(null);
    setDraft(null);
  };

  const choose = (promptId: string) => {
    if (!sheet) return;
    const slot = sheet.slot;
    const toEditor = (text: string, saved: string) => {
      setDraft({ promptId, text, saved });
      setExIndex(0);
      setShowTr(false);
      setSheet({ mode: 'editor', slot });
    };
    if (!draft || !draft.text.trim() || draft.promptId === promptId) {
      return toEditor(draft?.text ?? '', draft?.saved ?? '');
    }
    // Never re-attach an answer to another question without asking.
    Alert.alert('Keep your answer?', 'You already wrote something for the other prompt.', [
      { text: 'Keep and edit it', onPress: () => toEditor(draft.text, draft.saved) },
      { text: 'Start fresh', style: 'destructive', onPress: () => toEditor('', draft.saved) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const cancelEditor = () => {
    if (draft && draft.text !== draft.saved && draft.text.trim()) {
      Alert.alert('Discard changes?', 'Your edits to this answer will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: close },
      ]);
      return;
    }
    close();
  };

  const save = () => {
    if (!sheet || !draft) return;
    const slot = sheet.slot;
    const { promptId, text } = draft;
    updatePrompts((list) => saveSlot(list, slot, promptId, text));
    close();
  };

  const slot = sheet?.slot ?? 0;
  const used = usedPromptIds(prompts, sheet ? slot : null);
  const entry = draft ? promptById(draft.promptId) : undefined;
  const canSave =
    !!draft && !!entry && draft.text.trim().length > 0 && draft.text.length <= ANSWER_MAX_LENGTH && !used.has(draft.promptId);
  const example = entry ? entry.examples[exLang][exIndex % 2] : '';

  return (
    <View style={styles.wrap}>
      {prompts.map((a, i) => {
        const filled = answerFilled(a);
        const optional = i >= REQUIRED_PROMPTS;
        if (!filled) {
          return (
            <TouchableOpacity
              key={`slot-${i}`}
              onPress={() => openSlot(i)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Choose a prompt, ${optional ? 'optional' : 'required'}`}
              style={[styles.card, styles.emptyCard]}>
              <Ionicons name="add-circle-outline" size={22} color={obColors.cta} />
              <View style={styles.emptyText}>
                <Text style={styles.emptyTitle} maxFontSizeMultiplier={1.6}>
                  Choose a prompt
                </Text>
                <Text style={styles.meta} maxFontSizeMultiplier={1.6}>
                  {optional ? 'Optional' : 'Required'}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }
        const label = promptById(a.promptId)?.en ?? '';
        return (
          <TouchableOpacity
            key={`slot-${i}`}
            onPress={() => openSlot(i)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${a.answer}. Edit`}
            style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.promptTitle} maxFontSizeMultiplier={1.6}>
                {label}
              </Text>
              <Text style={styles.link} maxFontSizeMultiplier={1.4}>
                Edit
              </Text>
            </View>
            <Text style={styles.answerPreview} numberOfLines={3} maxFontSizeMultiplier={1.6}>
              {a.answer}
            </Text>
            {optional ? (
              <TouchableOpacity
                onPress={() => updatePrompts((l) => clearSlot(l, i))}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Remove third answer"
                style={styles.remove}>
                <Text style={styles.link} maxFontSizeMultiplier={1.4}>
                  Remove
                </Text>
              </TouchableOpacity>
            ) : null}
          </TouchableOpacity>
        );
      })}
      <Text style={styles.meta} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
        {answered} of {REQUIRED_PROMPTS} required answered
      </Text>

      <Modal visible={!!sheet} animationType="slide" onRequestClose={sheet?.mode === 'editor' ? cancelEditor : close}>
        <KeyboardAvoidingView
          style={[styles.sheet, { paddingTop: insets.top + obSpacing.sm }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {sheet?.mode === 'picker' ? (
            <>
              <View style={styles.sheetHead}>
                <Pressable
                  onPress={() => (sheet.fromEditor ? setSheet({ mode: 'editor', slot: sheet.slot }) : close())}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={sheet.fromEditor ? 'Back to your answer' : 'Close'}>
                  <Ionicons name={sheet.fromEditor ? 'chevron-back' : 'close'} size={26} color={obColors.textPrimary} />
                </Pressable>
                <Text style={styles.sheetTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
                  Choose a prompt
                </Text>
                <View style={styles.headSpacer} />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.catScroll}
                contentContainerStyle={styles.catRow}>
                {PROMPT_CATEGORIES.map((c) => {
                  const on = category === c.key;
                  return (
                    <TouchableOpacity
                      key={c.key}
                      onPress={() => setCategory(c.key)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      style={[styles.cat, on && styles.catOn]}>
                      <Text style={[styles.catText, on && styles.catTextOn]} maxFontSizeMultiplier={1.4}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <FlatList
                data={promptsInCategory(category)}
                keyExtractor={(e) => e.id}
                contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, obSpacing.lg) }}
                renderItem={({ item }) => {
                  const taken = used.has(item.id);
                  const current = draft?.promptId === item.id;
                  return (
                    <TouchableOpacity
                      onPress={() => choose(item.id)}
                      disabled={taken}
                      accessibilityRole="button"
                      accessibilityLabel={taken ? `${item.en}, already on your profile` : item.en}
                      accessibilityState={{ disabled: taken, selected: current }}
                      style={[styles.row, taken && styles.rowTaken]}>
                      <Text style={styles.rowText} maxFontSizeMultiplier={1.6}>
                        {item.en}
                      </Text>
                      {taken ? (
                        <Text style={styles.meta} maxFontSizeMultiplier={1.4}>
                          Already added
                        </Text>
                      ) : current ? (
                        <Ionicons name="checkmark" size={18} color={obColors.cta} />
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
              />
            </>
          ) : null}

          {sheet?.mode === 'editor' && draft && entry ? (
            <>
              <View style={styles.sheetHead}>
                <Pressable onPress={cancelEditor} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cancel">
                  <Text style={styles.headAction} maxFontSizeMultiplier={1.4}>
                    Cancel
                  </Text>
                </Pressable>
                <Pressable
                  onPress={save}
                  disabled={!canSave}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel="Save answer"
                  accessibilityState={{ disabled: !canSave }}>
                  <Text style={[styles.headAction, styles.headSave, !canSave && styles.headDisabled]} maxFontSizeMultiplier={1.4}>
                    Save
                  </Text>
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={styles.editorBody} keyboardShouldPersistTaps="handled">
                <View style={styles.editorPrompt}>
                  <Text style={styles.editorTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
                    {entry.en}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setSheet({ mode: 'picker', slot: sheet.slot, fromEditor: true })}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel="Change prompt">
                    <Text style={styles.link} maxFontSizeMultiplier={1.4}>
                      Change
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => setShowTr((v) => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: showTr }}
                  accessibilityLabel="Türkçesi">
                  <Text style={styles.linkSmall} maxFontSizeMultiplier={1.4}>
                    {showTr ? `Türkçesi: ${entry.tr}` : 'Türkçesi'}
                  </Text>
                </TouchableOpacity>
                <Text style={styles.meta} maxFontSizeMultiplier={1.6}>
                  Türkçe veya İngilizce yazabilirsin. {ANSWER_HINT}
                </Text>
                {/* Explicit lineHeight: a recycled iOS TextInput must not keep a
                    previous paragraph style (P05 R2 root cause). */}
                <TextInput
                  value={draft.text}
                  onChangeText={(text) => setDraft((d) => (d ? { ...d, text } : d))}
                  multiline
                  autoFocus
                  maxLength={ANSWER_MAX_LENGTH}
                  placeholder={example}
                  placeholderTextColor={obColors.textSecondary}
                  accessibilityLabel={`Your answer to: ${entry.en}`}
                  accessibilityHint={`Example: ${example}`}
                  keyboardAppearance="light"
                  selectionColor={obColors.cta}
                  autoCapitalize="sentences"
                  maxFontSizeMultiplier={1.6}
                  textAlignVertical="top"
                  style={styles.editorInput}
                />
                <View style={styles.editorMeta}>
                  <View style={styles.langRow} accessibilityRole="radiogroup" accessibilityLabel="Example language">
                    {(['en', 'tr'] as const).map((l) => (
                      <TouchableOpacity
                        key={l}
                        onPress={() => setExLang(l)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: exLang === l }}
                        accessibilityLabel={l === 'en' ? 'English examples' : 'Türkçe örnekler'}
                        style={[styles.lang, exLang === l && styles.langOn]}>
                        <Text style={[styles.langText, exLang === l && styles.langTextOn]} maxFontSizeMultiplier={1.3}>
                          {l.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.meta} maxFontSizeMultiplier={1.4}>
                    {draft.text.length}/{ANSWER_MAX_LENGTH}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setExIndex((n) => n + 1)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Show another example">
                  <Text style={styles.linkSmall} maxFontSizeMultiplier={1.4}>
                    Show another example
                  </Text>
                </TouchableOpacity>
                {draft.text.length > 0 ? (
                  <Text style={styles.meta} maxFontSizeMultiplier={1.6}>
                    Example: {example}
                  </Text>
                ) : null}
              </ScrollView>
            </>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: obSpacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: obColors.border,
    borderRadius: 12,
    paddingHorizontal: obSpacing.lg,
    paddingVertical: obSpacing.md,
    gap: obSpacing.xs,
  },
  emptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.md,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    minHeight: 72,
  },
  emptyText: {
    flex: 1,
    gap: 2,
  },
  emptyTitle: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: obColors.cta,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: obSpacing.md,
  },
  promptTitle: {
    flex: 1,
    fontFamily: obFonts.heading,
    fontSize: 17,
    lineHeight: 23,
    color: obColors.textPrimary,
  },
  answerPreview: {
    fontFamily: obFonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: obColors.textPrimary,
  },
  link: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.cta,
  },
  linkSmall: {
    fontFamily: obFonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.cta,
    textDecorationLine: 'underline',
  },
  remove: {
    alignSelf: 'flex-start',
  },
  meta: {
    fontFamily: obFonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: obColors.textSecondary,
  },
  sheet: {
    flex: 1,
    backgroundColor: obColors.background,
    paddingHorizontal: obSpacing.gutter,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
  },
  headSpacer: {
    width: 26,
  },
  sheetTitle: {
    fontFamily: obFonts.heading,
    fontSize: 22,
    lineHeight: 28,
    color: obColors.textPrimary,
  },
  headAction: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: obColors.textSecondary,
  },
  headSave: {
    color: obColors.cta,
  },
  headDisabled: {
    color: obColors.ctaDisabled,
  },
  catScroll: {
    flexGrow: 0,
    marginTop: obSpacing.sm,
  },
  catRow: {
    gap: obSpacing.sm,
    paddingBottom: obSpacing.md,
  },
  cat: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: obSpacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: obColors.border,
  },
  catOn: {
    backgroundColor: obColors.cta,
    borderColor: obColors.cta,
  },
  catText: {
    fontFamily: obFonts.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
    color: obColors.textPrimary,
  },
  catTextOn: {
    color: obColors.onCta,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: obSpacing.md,
    paddingVertical: obSpacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: obColors.border,
  },
  rowTaken: {
    opacity: 0.45,
  },
  rowText: {
    flex: 1,
    fontFamily: obFonts.body,
    fontSize: 17,
    lineHeight: 23,
    color: obColors.textPrimary,
  },
  editorBody: {
    gap: obSpacing.sm,
    paddingTop: obSpacing.md,
    paddingBottom: obSpacing.xxl,
  },
  editorPrompt: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: obSpacing.md,
  },
  editorTitle: {
    flex: 1,
    fontFamily: obFonts.heading,
    fontSize: 24,
    lineHeight: 31,
    color: obColors.textPrimary,
  },
  editorInput: {
    minHeight: 150,
    marginTop: obSpacing.sm,
    padding: obSpacing.md,
    borderWidth: 1,
    borderColor: obColors.border,
    borderRadius: 12,
    backgroundColor: '#FFFDF8',
    fontFamily: obFonts.body,
    fontSize: 18,
    lineHeight: 25,
    color: obColors.textPrimary,
  },
  editorMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  langRow: {
    flexDirection: 'row',
    gap: obSpacing.xs,
  },
  lang: {
    minWidth: 44,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: obSpacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: obColors.border,
  },
  langOn: {
    backgroundColor: obColors.selectedFill,
    borderColor: obColors.cta,
  },
  langText: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: obColors.textSecondary,
  },
  langTextOn: {
    color: obColors.cta,
  },
});
