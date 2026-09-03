/** Shared design tokens used across screens. */

export const colors = {
  // Was gold (#B8860B) — app-wide switch to Raya's black/monochrome
  // identity (2026-09-03, user request), matching the onboarding flow's
  // color choice from the previous session.
  accent: '#1A1A1A',
  bgPrimary: '#F5F5F5',
  bgCard: '#FFFFFF',
  bgSubtle: '#F5F5F5', // input / disabled fill
  border: '#EEEEEE', // hairline separators
  textPrimary: '#1A1A1A',
  textMuted: '#8E8E93', // iOS system gray — placeholders, secondary text
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  pill: 20,
} as const;
