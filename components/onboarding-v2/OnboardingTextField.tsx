// Labelled text field for onboarding V2 (D46): thin underline, no enclosing
// box. Optional unit suffix (e.g. "cm"). No validation rules of its own.
import { forwardRef, useRef, useState } from 'react';

import { useRevealInScroll } from '@/components/onboarding-v2/OnboardingScrollContext';
import {
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
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
  const wrapRef = useRef<View>(null);
  const reveal = useRevealInScroll();
  // Explicit height from the font's real line box (DM Sans: 1.302 em, from
  // the bundled font's hhea metrics) × the user's text scale (capped like
  // maxFontSizeMultiplier) + vertical padding. A fixed minHeight of 44 left
  // only 32 pt for text, less than the 32–40 pt line box at larger text
  // sizes, which clips glyphs on iOS (P05 R1).
  const { fontScale } = useWindowDimensions();
  const inputHeight = Math.max(
    44,
    Math.ceil(INPUT_FONT_SIZE * LINE_BOX_EM * Math.min(fontScale, MAX_SCALE)) + INPUT_PAD_Y + 4,
  );
  return (
    <View ref={wrapRef} style={[styles.wrap, containerStyle]}>
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
          maxFontSizeMultiplier={MAX_SCALE}
          {...inputProps}
          onFocus={(e) => {
            setFocused(true);
            // Bring the field (and anything right under it, e.g. suggestions)
            // into view above the keyboard and the pinned footer.
            setTimeout(() => reveal(wrapRef), 250);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            { height: inputHeight },
            focused && styles.inputFocused,
            suffix ? styles.inputWithSuffix : null,
          ]}
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

const INPUT_FONT_SIZE = 19;
const LINE_BOX_EM = 1.302;
const MAX_SCALE = 1.6;
const INPUT_PAD_Y = obSpacing.xs + obSpacing.sm;

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
    paddingHorizontal: 0,
    paddingTop: obSpacing.xs,
    paddingBottom: obSpacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: obColors.border,
    backgroundColor: 'transparent',
    fontFamily: obFonts.body,
    fontSize: INPUT_FONT_SIZE,
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
