/**
 * Shared "what kind of date sounds fun" venue options — used by onboarding
 * (profile-setup/step4.tsx) and profile-edit.tsx. Single source of truth so
 * editing after onboarding can't drift into different label strings for the
 * same `profiles.meeting_environment` values (get_top_matches scores overlap
 * on exact string match, so a drifted label silently breaks that scoring).
 */
export const MEETING_VENUE_OPTIONS = [
  { label: 'A coffee date ☕', spotKey: 'coffee', placeholder: "What's your favorite coffee place? (optional)" },
  { label: 'A walk outside 🌿', spotKey: 'park', placeholder: "What's your favorite park or area? (optional)" },
  { label: 'Dinner somewhere nice 🍽', spotKey: 'dinner', placeholder: 'Any favorite restaurant or cuisine? (optional)' },
  { label: 'Drinks at a bar 🍸', spotKey: 'drinks', placeholder: 'Any favorite bar or spot? (optional)' },
  { label: 'Something active & fun 🎯', spotKey: 'active', placeholder: 'What kind of activity do you enjoy? (optional)' },
] as const;
