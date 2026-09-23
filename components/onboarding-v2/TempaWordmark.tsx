// Single replacement point for the Tempa header wordmark (DECISIONS D43).
// "Tempa" is the working name only — not a final brand or logo decision.
// When the final logo exists, swap the body of this component (e.g. an SVG or
// <Image>) and every onboarding header updates with it.
import { StyleSheet, Text } from 'react-native';

import { obColors, obFonts } from '@/lib/onboardingV2/theme';

export const BRAND_NAME = 'Tempa';

export function TempaWordmark() {
  return (
    <Text
      style={styles.wordmark}
      accessibilityRole="header"
      accessibilityLabel={BRAND_NAME}
      maxFontSizeMultiplier={1.3}>
      {BRAND_NAME}
    </Text>
  );
}

const styles = StyleSheet.create({
  wordmark: {
    fontFamily: obFonts.heading,
    fontSize: 20,
    lineHeight: 26,
    color: obColors.textPrimary,
  },
});
