import { obColors, obFonts } from '@/lib/onboardingV2/theme';

/**
 * Home/Discovery-only design tokens ("Warm Editorial" visual direction,
 * 2026-09-16 — ChatGPT-authored redesign brief, approved by user).
 *
 * Deliberately NOT merged into the shared `designTokens.ts` — that file's
 * `colors.accent` (black) and `radius.pill` (20) are used app-wide (Matches,
 * Activity, Chats, Profile, Filters, ...). Redefining them here instead of
 * touching the shared file keeps this redesign scoped to Home only, per the
 * brief's own explicit boundary ("Matches/Activity/Chats/Profile ekranlarının
 * iç tasarımlarını değiştirme").
 */

// 2026-10-01 (owner): the main screens use the APPROVED onboarding theme —
// warm ivory, very dark forest green, pale sage (lib/onboardingV2/theme.ts,
// DECISIONS D2/D46). Same keys as before so every Discover/Matches component
// follows without per-file edits; the former coral/near-white values are gone.
export const homeColors = {
  background: obColors.background, // warm ivory
  surface: '#FFFDF8', // card surface (same as the approved profile preview cards)
  textPrimary: obColors.textPrimary,
  textSecondary: obColors.textSecondary,
  accent: obColors.cta, // dark forest green
  accentSoft: obColors.selectedFill, // pale sage
  border: '#E4DCCB',
  mutedSurface: obColors.notice,
  verifiedBadge: 'rgba(28,27,24,0.88)',
  segmentTrack: '#D9D1C0',
} as const;

/** Approved fonts: Playfair Display (titles, names, prompt answers) + DM Sans. */
export const homeFonts = obFonts;

// 4px-based scale (brief asks for 4/8/12/16/20/24/32 — the shared
// `spacing` token in designTokens.ts already covers 4/8/12/16/24; only
// 20 and 32 are new, added here rather than widening the shared scale.
export const homeSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const homeRadius = {
  pill: 999,
  cardSmall: 16,
  card: 20,
  heroPhoto: 24,
} as const;

// Very light, warm-toned shadow — brief explicitly asks to avoid heavy gray
// shadows. Same value pair works for both card-level and button-level use.
export const homeShadow = {
  shadowColor: '#3A2A24',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 3,
} as const;

// Wordmark is a placeholder — the real name/logo isn't decided yet. Kept as
// a single constant so swapping it later doesn't mean hunting through
// components.
export const HOME_BRAND_NAME = 'Tempa';
