// Labelled text field for onboarding V2 (D46): thin underline, no enclosing
// box. Optional unit suffix (e.g. "cm"). No validation rules of its own.
import { forwardRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { obColors, obFonts, obSpacing } from '@/lib/onboardingV2/theme';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Visible unit shown after the input on the same underline. */
  suffix?: string;
  containerStyle?: StyleProp<ViewStyle>;
};

export const OnboardingTextField = forwardRef<TextInput, Props>(function OnboardingTextField(
  { label, suffix, containerStyle, onFocus, onBlur, ...inputProps },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.wrap, containerStyle]}>
      <Text style={styles.label} maxFontSizeMultiplier={1.6}>
        {label}
      </Text>
      {/* The underline lives on the TextInput itself (the P01 structure that
          was verified on device). Wrapping the input in a flex row clipped the
          text/placeholder vertically on iOS (P05 phone report), so the optional
          suffix is overlaid on the right instead. */}
      <View>
        <TextInput
          ref={ref}
          accessibilityLabel={suffix ? `${label}, ${suffix}` : label}
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
          style={[styles.input, focused && styles.inputFocused, suffix ? styles.inputWithSuffix : null]}
        />
        {suffix ? (
          <Text style={styles.suffix} pointerEvents="none" maxFontSizeMultiplier={1.6}>
            {suffix}
          </Text>
        ) : null}
      </View>
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
  inputWithSuffix: {
    paddingRight: 32,
  },
  suffix: {
    position: 'absolute',
    right: 0,
    bottom: obSpacing.sm,
    fontFamily: obFonts.body,
    fontSize: 17,
    lineHeight: 24,
    color: obColors.textSecondary,
  },
});
