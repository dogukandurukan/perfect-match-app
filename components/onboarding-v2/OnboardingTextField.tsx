// Labelled text field for onboarding V2 (D46): thin underline, no enclosing
// box. No validation rules of its own.
import { forwardRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

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
        keyboardAppearance="light"
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
    gap: obSpacing.xs,
  },
  label: {
    fontFamily: obFonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: obColors.textSecondary,
  },
  input: {
    minHeight: 44,
    paddingHorizontal: 0,
    paddingTop: obSpacing.xs,
    paddingBottom: obSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: obColors.border,
    backgroundColor: 'transparent',
    fontFamily: obFonts.body,
    fontSize: 19,
    color: obColors.textPrimary,
  },
  inputFocused: {
    borderBottomColor: obColors.borderFocused,
  },
});
