// Dark green primary CTA for onboarding V2.
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { obColors, obFonts, obRadius } from '@/lib/onboardingV2/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export function OnboardingPrimaryButton({ label, onPress, disabled = false }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.button, disabled && styles.buttonDisabled]}>
      <Text style={styles.label} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 54,
    borderRadius: obRadius.button,
    backgroundColor: obColors.cta,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  buttonDisabled: {
    backgroundColor: obColors.ctaDisabled,
  },
  label: {
    fontFamily: obFonts.bodySemiBold,
    fontSize: 17,
    lineHeight: 22,
    color: obColors.onCta,
  },
});
