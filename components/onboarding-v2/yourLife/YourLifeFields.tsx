// Section 4 Your Life — per-step content (P04). Presentational only; the
// draft lives in PreviewFlow.
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import { OnboardingOptionCard } from '@/components/onboarding-v2/OnboardingOptionCard';
import {
  PET_KIND_OPTIONS,
  PET_KIND_TITLE,
  selectLifeAnswer,
  selectPetKind,
  showPetKind,
  type LifeDraft,
  type LifeIcon,
  type LifeQuestion,
} from '@/lib/onboardingV2/yourLife';
import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

type Props = {
  draft: LifeDraft;
  update: (patch: Partial<LifeDraft>) => void;
};

export function LifeGlyph({ icon, size = 20 }: { icon: LifeIcon; size?: number }) {
  if (icon.family === 'ion') {
    return <Ionicons name={icon.name as keyof typeof Ionicons.glyphMap} size={size} color={obColors.cta} />;
  }
  return (
    <MaterialCommunityIcons
      name={icon.name as keyof typeof MaterialCommunityIcons.glyphMap}
      size={size}
      color={obColors.cta}
    />
  );
}

// Pet-kind chips go on one row only if the widest chip fits a quarter of the
// width; otherwise 2 × 2. Widest chip = "Both" (two 18pt icons + label):
// 103.1pt at 15pt DM Sans Medium, measured from the bundled font. On current
// phone widths this means 2 × 2; labels are never shrunk or clipped.
const WIDEST_CHIP_AT_15PT = 103.1;
const CHIP_GAP = 8;

function usePetKindOneRow(): boolean {
  const { width, fontScale } = useWindowDimensions();
  const slot = (width - 48 - CHIP_GAP * 3) / 4;
  return slot >= WIDEST_CHIP_AT_15PT * Math.min(fontScale, 1.6);
}

export function LifeQuestionFields({ question, draft, update }: Props & { question: LifeQuestion }) {
  const current = draft[question.id];
  const oneRow = usePetKindOneRow();
  return (
    <View style={styles.wrap}>
      <View style={styles.options} accessibilityRole="radiogroup">
        {question.options.map((o) => (
          <OnboardingOptionCard
            key={o.key}
            label={o.title}
            mode="single"
            selectedFill
            selected={current === o.key}
            onPress={() => update(selectLifeAnswer(draft, question.id, o.key))}
          />
        ))}
      </View>

      {question.id === 'pets' && showPetKind(draft) ? (
        <View style={styles.kindWrap}>
          <Text style={styles.kindTitle} accessibilityRole="header" maxFontSizeMultiplier={1.6}>
            {PET_KIND_TITLE}
          </Text>
          <View style={styles.kindGrid} accessibilityRole="radiogroup">
            {PET_KIND_OPTIONS.map((k) => {
              const selected = draft.petKind === k.key;
              return (
                <TouchableOpacity
                  key={k.key}
                  onPress={() => update(selectPetKind(draft, k.key))}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityLabel={k.key === 'both' ? 'Both, dog and cat' : k.label}
                  accessibilityState={{ selected }}
                  style={[
                    styles.chip,
                    oneRow ? styles.chipQuarter : styles.chipHalf,
                    selected && styles.chipSelected,
                  ]}>
                  <View style={styles.chipIcons} importantForAccessibility="no-hide-descendants">
                    {k.icons.map((ic, i) => (
                      <LifeGlyph key={i} icon={ic} size={18} />
                    ))}
                  </View>
                  <Text style={styles.chipText} maxFontSizeMultiplier={1.6}>
                    {k.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: obSpacing.xl,
  },
  options: {
    gap: obSpacing.md,
  },
  kindWrap: {
    gap: obSpacing.md,
  },
  kindTitle: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 16,
    lineHeight: 22,
    color: obColors.textPrimary,
  },
  kindGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: CHIP_GAP,
  },
  chip: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: obColors.border,
    borderRadius: 12,
  },
  chipHalf: {
    width: '48.5%',
  },
  chipQuarter: {
    width: '23%',
  },
  chipSelected: {
    backgroundColor: obColors.selectedFill,
    borderColor: obColors.cta,
  },
  chipIcons: {
    flexDirection: 'row',
    gap: 2,
  },
  chipText: {
    flexShrink: 1,
    fontFamily: obFonts.bodyMedium,
    fontSize: 15,
    lineHeight: 20,
    color: obColors.textPrimary,
  },
});
