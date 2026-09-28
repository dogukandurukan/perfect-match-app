// Section 7.2 A little more you (P07, R1 shorter library). Two required
// answers, optional third. Answers start empty and are never autofilled; the
// example text is only a placeholder (not stored, never counts as an answer).
import { Ionicons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRevealInScroll } from '@/components/onboarding-v2/OnboardingScrollContext';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';
import {
  ANSWER_HINT,
  ANSWER_MAX_LENGTH,
  PROMPTS,
  addThirdPrompt,
  availablePrompts,
  changePrompt,
  promptHint,
  promptLabel,
  removeThirdPrompt,
  setAnswer,
  type PromptId,
  type ProfileDraft,
} from '@/lib/onboardingV2/yourProfile';

type Props = {
  draft: ProfileDraft;
  update: (patch: Partial<ProfileDraft>) => void;
};

function AnswerInput({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  placeholder: string;
}) {
  const wrapRef = useRef<View>(null);
  const reveal = useRevealInScroll();
  const [focused, setFocused] = useState(false);
  return (
    <View ref={wrapRef} style={styles.answerWrap}>
      {/* Explicit lineHeight: a recycled native TextInput must not keep a
          previous screen's paragraph style (P05 R2 root cause). */}
      <TextInput
        value={value}
        onChangeText={onChange}
        multiline
        maxLength={ANSWER_MAX_LENGTH}
        placeholder={placeholder}
        placeholderTextColor={obColors.textSecondary}
        accessibilityLabel={`Answer: ${label}`}
        accessibilityHint={ANSWER_HINT}
        keyboardAppearance="light"
        selectionColor={obColors.cta}
        maxFontSizeMultiplier={1.6}
        autoCapitalize="sentences"
        scrollEnabled={false}
        onFocus={() => {
          setFocused(true);
          setTimeout(() => reveal(wrapRef), 250);
        }}
        onBlur={() => setFocused(false)}
        style={[styles.answer, focused && styles.answerFocused]}
      />
      <View style={styles.answerMeta}>
        <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
          {ANSWER_HINT}
        </Text>
        <Text style={styles.hint} maxFontSizeMultiplier={1.6} accessibilityLabel={`${value.length} of ${ANSWER_MAX_LENGTH} characters`}>
          {value.length}/{ANSWER_MAX_LENGTH}
        </Text>
      </View>
    </View>
  );
}

type Picker = { slot: number | null } | null;

export function PromptsFields({ draft, update }: Props) {
  const [picker, setPicker] = useState<Picker>(null);
  const insets = useSafeAreaInsets();
  const prompts = draft.prompts;
  const choices = picker ? availablePrompts(prompts, picker.slot) : [];

  const choose = (id: PromptId) => {
    const target = picker;
    setPicker(null);
    if (!target) return;
    if (target.slot === null) return update({ prompts: addThirdPrompt(prompts, id) });
    const slot = target.slot;
    if (prompts[slot].promptId === id) return;
    if (!prompts[slot].answer.trim()) return update({ prompts: changePrompt(prompts, slot, id) });
    // Never discard an answer silently. Wait for the sheet to close: iOS can't
    // present an alert while a modal is dismissing.
    setTimeout(() => {
      Alert.alert('Change question?', 'You already wrote an answer.', [
        { text: 'Keep my answer', onPress: () => update({ prompts: changePrompt(prompts, slot, id) }) },
        {
          text: 'Start a new answer',
          style: 'destructive',
          onPress: () => update({ prompts: changePrompt(prompts, slot, id, true) }),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }, 400);
  };

  return (
    <View style={styles.wrap}>
      {prompts.map((a, i) => {
        const label = promptLabel(a.promptId);
        return (
          <View key={`slot-${i}`} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.promptTitle} accessibilityRole="header" maxFontSizeMultiplier={1.6}>
                {label}
              </Text>
              <TouchableOpacity
                onPress={() => setPicker({ slot: i })}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel={`Change question: ${label}`}
                style={styles.link}>
                <Ionicons name="swap-horizontal-outline" size={15} color={obColors.cta} />
                <Text style={styles.linkText} maxFontSizeMultiplier={1.4}>
                  Change
                </Text>
              </TouchableOpacity>
            </View>
            <AnswerInput
              label={label}
              placeholder={promptHint(a.promptId)}
              value={a.answer}
              onChange={(v) => update({ prompts: setAnswer(prompts, i, v) })}
            />
            {i === 2 ? (
              <TouchableOpacity
                onPress={() => update({ prompts: removeThirdPrompt(prompts) })}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Remove third answer"
                style={styles.removeLink}>
                <Text style={styles.linkText} maxFontSizeMultiplier={1.4}>
                  Remove
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        );
      })}

      {prompts.length === 2 ? (
        <TouchableOpacity
          onPress={() => setPicker({ slot: null })}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Add another answer, optional"
          style={styles.addCard}>
          <Ionicons name="add-circle-outline" size={26} color={obColors.cta} />
          <Text style={styles.addTitle} maxFontSizeMultiplier={1.6}>
            Add another answer
          </Text>
          <Text style={styles.hint} maxFontSizeMultiplier={1.6}>
            Optional
          </Text>
        </TouchableOpacity>
      ) : null}

      <Modal visible={picker !== null} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, obSpacing.lg) }]}>
          <Text style={styles.sheetTitle} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
            Choose a question
          </Text>
          <ScrollView contentContainerStyle={styles.sheetList}>
            {PROMPTS.filter((p) => choices.includes(p.id)).map((p) => {
              const current = picker?.slot !== null && picker?.slot !== undefined && prompts[picker.slot]?.promptId === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => choose(p.id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={p.label}
                  accessibilityState={{ selected: current }}
                  style={[styles.option, current && styles.optionSelected]}>
                  <Text style={styles.optionText} maxFontSizeMultiplier={1.6}>
                    {p.label}
                  </Text>
                  {current ? <Ionicons name="checkmark" size={18} color={obColors.cta} /> : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            onPress={() => setPicker(null)}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            style={styles.cancel}>
            <Text style={styles.linkText} maxFontSizeMultiplier={1.4}>
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
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
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 24,
  },
  linkText: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.cta,
  },
  removeLink: {
    alignSelf: 'flex-start',
  },
  answerWrap: {
    gap: obSpacing.xs,
  },
  answer: {
    minHeight: 52,
    paddingHorizontal: 0,
    paddingTop: 4,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: obColors.border,
    fontFamily: obFonts.body,
    fontSize: 16,
    lineHeight: 22,
    color: obColors.textPrimary,
    textAlignVertical: 'top',
  },
  answerFocused: {
    borderBottomColor: obColors.borderFocused,
  },
  answerMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: obSpacing.md,
  },
  hint: {
    fontFamily: obFonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: obColors.textSecondary,
  },
  addCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 84,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: obColors.border,
    borderRadius: 12,
    padding: obSpacing.lg,
  },
  addTitle: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: obColors.cta,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  sheet: {
    backgroundColor: obColors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: obSpacing.xl,
    paddingHorizontal: obSpacing.gutter,
    maxHeight: '75%',
    gap: obSpacing.md,
  },
  sheetTitle: {
    fontFamily: obFonts.heading,
    fontSize: 22,
    lineHeight: 28,
    color: obColors.textPrimary,
  },
  sheetList: {
    gap: obSpacing.sm,
  },
  option: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: obSpacing.md,
    paddingHorizontal: obSpacing.lg,
    paddingVertical: obSpacing.md,
    borderWidth: 1,
    borderColor: obColors.border,
    borderRadius: 12,
  },
  optionSelected: {
    backgroundColor: obColors.selectedFill,
    borderColor: obColors.cta,
  },
  optionText: {
    flex: 1,
    fontFamily: obFonts.bodyMedium,
    fontSize: 16,
    lineHeight: 21,
    color: obColors.textPrimary,
  },
  cancel: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
