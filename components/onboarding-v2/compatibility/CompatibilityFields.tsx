// Section 3 Compatibility — per-step content (P03, revised in P03 R1).
// Presentational only; the draft lives in PreviewFlow.
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { OnboardingOptionCard } from '@/components/onboarding-v2/OnboardingOptionCard';
import {
  MAX_VALUES,
  VALUE_OPTIONS,
  toggleValue,
  type CompatDraft,
  type SingleQuestion,
  type ValueIcon,
} from '@/lib/onboardingV2/compatibility';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

type Props = {
  draft: CompatDraft;
  update: (patch: Partial<CompatDraft>) => void;
};

// Q1–Q6: single choice, short approved copy, no subtitles, no preselection.
export function SingleChoiceFields({ question, draft, update }: Props & { question: SingleQuestion }) {
  const current = draft[question.id];
  return (
    <View style={styles.options} accessibilityRole="radiogroup">
      {question.options.map((o) => (
        <OnboardingOptionCard
          key={o.key}
          label={o.title}
          mode="single"
          selected={current === o.key}
          onPress={() => update({ [question.id]: o.key } as Partial<CompatDraft>)}
        />
      ))}
    </View>
  );
}

function ValueGlyph({ icon, color }: { icon: ValueIcon; color: string }) {
  if (icon.family === 'ion') {
    return <Ionicons name={icon.name as keyof typeof Ionicons.glyphMap} size={18} color={color} />;
  }
  return (
    <MaterialCommunityIcons
      name={icon.name as keyof typeof MaterialCommunityIcons.glyphMap}
      size={18}
      color={color}
    />
  );
}

// Two columns only when the widest single label word still fits on one line
// inside a half-width card; otherwise stack in one column so words never
// split. "Adventure" is the widest word: 74.6pt at 15pt DM Sans Medium
// (measured from the bundled font's advance widths).
const WIDEST_WORD_AT_15PT = 74.6;
const CARD_CHROME = 70; // padding + icon + gap + reserved check space
const SCREEN_GUTTERS = 48;

export function useTwoValueColumns(): boolean {
  const { width, fontScale } = useWindowDimensions();
  const textWidth = (width - SCREEN_GUTTERS) * 0.485 - CARD_CHROME;
  const scale = Math.min(fontScale, 1.6); // matches maxFontSizeMultiplier
  return textWidth >= WIDEST_WORD_AT_15PT * scale + 4;
}

// Q7: ten values, 2 columns × 5 rows (row-major), 1–2 selections. A third tap
// is refused (never replaces a choice); selected values stay deselectable.
export function ValuesFields({ draft, update }: Props) {
  const oneColumn = !useTwoValueColumns();
  const full = draft.values.length >= MAX_VALUES;
  return (
    <View style={styles.valuesWrap}>
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
              style={[
                styles.card,
                oneColumn ? styles.cardFull : styles.cardHalf,
                selected && styles.cardSelected,
                blocked && styles.cardBlocked,
              ]}>
              <ValueGlyph icon={v.icon} color={obColors.cta} />
              <Text style={styles.cardText} maxFontSizeMultiplier={1.6}>
                {v.label}
              </Text>
              {/* Check space is always reserved (paddingRight) so text never
                  shifts when a card becomes selected. */}
              <View style={[styles.check, selected && styles.checkOn]}>
                {selected ? <Ionicons name="checkmark" size={12} color={obColors.onCta} /> : null}
              </View>
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

const CHECK = 18;

const styles = StyleSheet.create({
  options: {
    gap: obSpacing.md,
  },
  valuesWrap: {
    gap: obSpacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  card: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: obSpacing.sm,
    paddingLeft: obSpacing.md,
    paddingRight: obSpacing.md + CHECK + 2,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: obColors.border,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  cardHalf: {
    width: '48.5%',
  },
  cardFull: {
    width: '100%',
  },
  cardSelected: {
    backgroundColor: obColors.selectedFill,
    borderColor: obColors.cta,
  },
  cardBlocked: {
    opacity: 0.45,
  },
  cardText: {
    flex: 1,
    fontFamily: obFonts.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
    color: obColors.textPrimary,
  },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: CHECK,
    height: CHECK,
    borderRadius: CHECK / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: {
    backgroundColor: obColors.cta,
  },
  count: {
    fontFamily: obFonts.body,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
});
