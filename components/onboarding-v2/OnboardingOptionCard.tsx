// Selectable option row for onboarding V2 (single = radio, multi = checkbox).
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  mode: 'single' | 'multi';
};

export function OnboardingOptionCard({ label, selected, onPress, mode }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole={mode === 'single' ? 'radio' : 'checkbox'}
      accessibilityLabel={label}
      accessibilityState={mode === 'single' ? { selected } : { checked: selected }}
      style={[styles.card, selected && styles.cardSelected]}>
      <Text style={styles.label} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
      {mode === 'single' ? (
        <View style={[styles.radio, selected && styles.markSelected]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      ) : (
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected ? <Ionicons name="checkmark" size={16} color={obColors.onCta} /> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: obSpacing.md,
    paddingHorizontal: obSpacing.lg,
    paddingVertical: obSpacing.md,
    borderWidth: 1,
    borderColor: obColors.border,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  cardSelected: {
    borderColor: obColors.cta,
    borderWidth: 1.5,
  },
  label: {
    flex: 1,
    fontFamily: obFonts.bodyMedium,
    fontSize: 17,
    lineHeight: 22,
    color: obColors.textPrimary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: obColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markSelected: {
    borderColor: obColors.cta,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: obColors.cta,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: obColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: obColors.cta,
    backgroundColor: obColors.cta,
  },
});
