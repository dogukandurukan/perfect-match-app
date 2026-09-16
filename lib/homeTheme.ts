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

export const homeColors = {
  background: '#F7F4EF',
  surface: '#FFFDFC',
  textPrimary: '#171717',
  textSecondary: '#6F6B68',
  accent: '#B65F54',
  accentSoft: '#F3DFDA',
  border: '#E8E2DD',
  mutedSurface: '#F1EEEA',
  verifiedBadge: 'rgba(23,23,23,0.88)',
  photoOverlay: 'rgba(0,0,0,0.55)',
} as const;

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
export const HOME_BRAND_NAME = 'tempa';
