// Tempa onboarding V2 — visual tokens (P01).
// Scoped to V2 onboarding only (docs/tempa DECISIONS D2, D42, D43). Do NOT
// import these from other app screens and do not merge them into
// lib/designTokens.ts — the rest of the app keeps its own palette until it is
// evaluated separately.
import { useFonts } from 'expo-font';

export const obColors = {
  background: '#F7F3EA', // warm ivory
  textPrimary: '#1C1B18', // headings + input text — dark, never faint
  textSecondary: '#5E5A52', // labels, helper copy
  border: '#C9C0AF', // thin input underline (D46)
  borderFocused: '#1F3A2E',
  cta: '#1F3A2E', // very dark green CTA / selected
  ctaDisabled: '#A9B3AC',
  onCta: '#FFFFFF',
  notice: '#EDE6D6',
  error: '#9A3324', // inline validation text (AA on ivory)
  selectedFill: '#E6ECE3', // pale sage — selected value cards (P03 R1)
} as const;

export const obSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  gutter: 24, // horizontal screen padding
} as const;

export const obRadius = {
  button: 14,
} as const;

// Each weight is its own family name so styles never set `fontWeight` on
// these fonts (which would trigger synthetic bold on some platforms).
export const obFonts = {
  heading: 'PlayfairDisplay-Bold', // Playfair Display 700
  body: 'DMSans-Regular', // DM Sans 400
  bodyMedium: 'DMSans-Medium', // DM Sans 500
  bodySemiBold: 'DMSans-SemiBold', // DM Sans 600
} as const;

/**
 * Loads the onboarding V2 fonts (static TTFs vendored in assets/fonts, OFL-1.1
 * licenses alongside). Uses the already-installed `expo-font` — no new native
 * module, no dev-client rebuild. Returns true once ready or if loading failed
 * (screens then fall back to the system font instead of hanging).
 */
export function useOnboardingFonts(): boolean {
  const [loaded, error] = useFonts({
    [obFonts.heading]: require('../../assets/fonts/PlayfairDisplay_700Bold.ttf'),
    [obFonts.body]: require('../../assets/fonts/DMSans_400Regular.ttf'),
    [obFonts.bodyMedium]: require('../../assets/fonts/DMSans_500Medium.ttf'),
    [obFonts.bodySemiBold]: require('../../assets/fonts/DMSans_600SemiBold.ttf'),
  });
  if (error && __DEV__) console.warn('[onboardingV2] font load failed', error);
  return loaded || !!error;
}
