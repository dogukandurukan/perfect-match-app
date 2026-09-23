// Labelled text field for onboarding V2. No validation rules of its own.
import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { obColors, obFonts, obRadius, obSpacing } from '@/lib/onboardingV2/theme';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
};

export const OnboardingTextField = forwardRef<TextInput, Props>(function OnboardingTextField(
  { label, onFocus, onBlur, ...inputProps },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <Text style={styles.label} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={obColors.textSecondary}
        selectionColor={obColors.cta}
        maxFontSizeMultiplier={1.6}
        {...inputProps}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[styles.input, focused && styles.inputFocused]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: obSpacing.sm,
  },
  label: {
    fontFamily: obFonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
  input: {
    minHeight: 52,
    paddingHorizontal: obSpacing.lg,
    paddingVertical: obSpacing.md,
    borderWidth: 1,
    borderColor: obColors.border,
    borderRadius: obRadius.field,
    backgroundColor: obColors.surface,
    fontFamily: obFonts.body,
    fontSize: 17,
    color: obColors.textPrimary,
  },
  inputFocused: {
    borderColor: obColors.borderFocused,
  },
});
