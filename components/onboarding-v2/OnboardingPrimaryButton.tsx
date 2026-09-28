// Dark green primary CTA for onboarding V2.
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { obColors, obFonts, obRadius } from '@/lib/onboardingV2/theme';

type Props = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Outline = secondary full-width action on ivory (P07 "Review my profile"). */
  variant?: 'solid' | 'outline';
};

export function OnboardingPrimaryButton({ label, onPress, disabled = false, variant = 'solid' }: Props) {
  const outline = variant === 'outline';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={[styles.button, outline && styles.buttonOutline, disabled && styles.buttonDisabled]}>
      <Text style={[styles.label, outline && styles.labelOutline]} maxFontSizeMultiplier={1.4}>
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
  buttonOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: obColors.cta,
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
  labelOutline: {
    color: obColors.cta,
  },
});
