// Section 3 Compatibility — per-step content (P03). Presentational only; the
// draft lives in PreviewFlow.
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { OnboardingOptionCard } from '@/components/onboarding-v2/OnboardingOptionCard';
import {
  MAX_VALUES,
  VALUE_OPTIONS,
  VALUES_HELPER,
  toggleValue,
  type CompatDraft,
  type SingleQuestion,
} from '@/lib/onboardingV2/compatibility';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

type Props = {
  draft: CompatDraft;
  update: (patch: Partial<CompatDraft>) => void;
};

// Q1–Q6: single choice with subtitles, no preselection.
export function SingleChoiceFields({ question, draft, update }: Props & { question: SingleQuestion }) {
  const current = draft[question.id];
  return (
    <View style={styles.options} accessibilityRole="radiogroup">
      {question.options.map((o) => (
        <OnboardingOptionCard
          key={o.key}
          label={o.title}
          subtitle={o.subtitle}
          mode="single"
          selected={current === o.key}
          onPress={() => update({ [question.id]: o.key } as Partial<CompatDraft>)}
        />
      ))}
    </View>
  );
}

// Q7: nine values in a 3-column grid, 1–2 selections. A third tap is refused
// (never replaces an existing choice); selected values stay deselectable.
export function ValuesFields({ draft, update }: Props) {
  const full = draft.values.length >= MAX_VALUES;
  return (
    <View style={styles.valuesWrap}>
      <Text style={styles.helper} maxFontSizeMultiplier={1.6}>
        {VALUES_HELPER}
      </Text>
      <View style={styles.grid}>
        {VALUE_OPTIONS.map((v) => {
          const selected = draft.values.includes(v.key);
          const blocked = full && !selected;
          return (
            <TouchableOpacity
              key={v.key}
              onPress={() => update({ values: toggleValue(draft.values, v.key) })}
              disabled={blocked}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityLabel={v.label}
              accessibilityState={{ checked: selected, disabled: blocked }}
              accessibilityHint={blocked ? 'Two values already chosen. Deselect one to change.' : undefined}
              style={[styles.chip, selected && styles.chipSelected, blocked && styles.chipBlocked]}>
              {selected ? <Ionicons name="checkmark" size={15} color={obColors.onCta} /> : null}
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
                maxFontSizeMultiplier={1.5}>
                {v.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.count} accessibilityLiveRegion="polite" maxFontSizeMultiplier={1.6}>
        {draft.values.length} of {MAX_VALUES} selected
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: obSpacing.md,
  },
  valuesWrap: {
    gap: obSpacing.lg,
  },
  helper: {
    fontFamily: obFonts.body,
    fontSize: 15,
    lineHeight: 21,
    color: obColors.textSecondary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: obSpacing.sm,
  },
  chip: {
    // ~3 per row; wraps to fewer per row with large text instead of clipping.
    flexGrow: 1,
    flexBasis: '30%',
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: obSpacing.sm,
    paddingVertical: obSpacing.sm,
    borderWidth: 1,
    borderColor: obColors.border,
    borderRadius: 12,
  },
  chipSelected: {
    backgroundColor: obColors.cta,
    borderColor: obColors.cta,
  },
  chipBlocked: {
    opacity: 0.45,
  },
  chipText: {
    fontFamily: obFonts.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
    color: obColors.textPrimary,
    textAlign: 'center',
    flexShrink: 1,
  },
  chipTextSelected: {
    color: obColors.onCta,
  },
  count: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
});
