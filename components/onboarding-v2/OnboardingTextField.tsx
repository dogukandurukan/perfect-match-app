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
  /** Screen shows its own visible heading; `label` then only names the field
   * for screen readers (P06 favorite spot). */
  hideLabel?: boolean;
};

export const OnboardingTextField = forwardRef<TextInput, Props>(function OnboardingTextField(
  { label, suffix, containerStyle, hideLabel = false, onFocus, onBlur, ...inputProps },
  ref,
) {
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<View>(null);
  const reveal = useRevealInScroll();
  const { fontScale } = useWindowDimensions();
  const inputHeight = fieldHeight(fontScale);
  return (
    <View ref={wrapRef} style={[styles.wrap, containerStyle]}>
      {hideLabel ? null : (
        <Text style={styles.label} maxFontSizeMultiplier={1.6}>
          {label}
        </Text>
      )}
      {/* Explicit lineHeight (P05 R2, root cause): on iOS, Fabric recycles
          native TextInput views across screens (RCTComponentViewRegistry
          recycle pool) and prepareForRecycle only clears attributedText — the
          previous input's paragraph style is not reset. After the height
          ruler (lineHeight 68) a recycled view drew the placeholder ~16 pt low
          and clipped it. Setting lineHeight here makes every mount apply its
          own paragraph style (≈ the font's own line box, so no extra baseline
          offset), overriding any stale one. Phone lab #2 showed only the first
          field of a screen clipped — consistent with recycling.
          No vertical padding on the native input (P05 R2). On iOS, RN's
          RCTUITextField insets typed text by the padding (it overrides
          textRectForBounds/editingRectForBounds) but does NOT override
          placeholderRectForBounds, so with padding the placeholder is laid
          out in a different rect than typed text — which matches the phone
          reports (placeholders clipped at the underline, typed names fine in
          P01). With zero vertical padding both rects equal the field bounds;
          the space around the text comes from the explicit height instead.
          The underline stays on the TextInput (border ≠ padding: RN subtracts
          the border from the inset). The optional suffix is overlaid. */}
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

export const INPUT_FONT_SIZE = 19;
/** DM Sans line box (hhea ascent 992 + descent 310, upm 1000) — bundled TTF. */
export const LINE_BOX_EM = 1.302;
const MAX_SCALE = 1.6;
/** ≈ DM Sans line box at 19 pt (24.7) — RN scales it with the text size. */
const INPUT_LINE_HEIGHT = 25;
/** Breathing room split evenly above/below the text inside the field. */
const FIELD_ROOM = 16;

/** Field height: font line box × text scale (capped like maxFontSizeMultiplier)
 * + room, never below the 44 pt touch target. 44 / 50 / 56 pt at 1.0 / 1.3 / 1.6×. */
export function fieldHeight(fontScale: number): number {
  return Math.max(44, Math.ceil(INPUT_FONT_SIZE * LINE_BOX_EM * Math.min(fontScale, MAX_SCALE)) + FIELD_ROOM);
}

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
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: obColors.border,
    backgroundColor: 'transparent',
    fontFamily: obFonts.body,
    fontSize: INPUT_FONT_SIZE,
    lineHeight: INPUT_LINE_HEIGHT,
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
    bottom: 10,
    fontFamily: obFonts.body,
    fontSize: 17,
    lineHeight: 24,
    color: obColors.textSecondary,
  },
});
