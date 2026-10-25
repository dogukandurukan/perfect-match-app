// DEV-ONLY design preview (branding / onboarding round 1): which screens and
// states app/dev/design-preview.tsx can show, plus the synthetic content and
// the preview-only copy proposals. Pure data — no React, no Supabase — so it
// is checked in Node (scripts/onboarding-v2-checks/design_preview.check.js).
//
// The preview renders the REAL onboarding components (OnboardingScreen,
// OnboardingTextField, ConsentRow, SingleChoiceFields, ReceivedFields). A copy
// proposal here only changes the preview; the live screens keep their copy
// until the owner approves a change.

export type DesignScreenId = 'welcome' | 'question' | 'received';

export type DesignStateId =
  // welcome
  | 'email-empty'
  | 'email-filled'
  | 'email-error'
  | 'code'
  | 'code-error'
  | 'spec-welcome'
  // question
  | 'question-empty'
  | 'question-selected'
  | 'question-save-error'
  // received
  | 'submitted'
  | 'rejected'
  | 'status-error';

export type DesignState = { id: DesignStateId; label: string; note?: string };

export type DesignScreen = {
  id: DesignScreenId;
  title: string;
  /** Where the live version lives — what a real change has to touch. */
  liveSource: string;
  states: DesignState[];
};

export const DESIGN_SCREENS: DesignScreen[] = [
  {
    id: 'welcome',
    title: '1 · Welcome / sign-in',
    liveSource: 'app/v2/welcome.tsx + components/onboarding-v2/account/AccountFields.tsx',
    states: [
      { id: 'email-empty', label: 'Email · empty' },
      { id: 'email-filled', label: 'Email · filled + consent' },
      { id: 'email-error', label: 'Email · send failed' },
      { id: 'code', label: 'Code · entered' },
      { id: 'code-error', label: 'Code · wrong code' },
      {
        id: 'spec-welcome',
        label: 'Spec welcome (not built)',
        note: 'Copy from docs/tempa/ONBOARDING_FLOW.md §1. Not in the live app today — the live entry is the signed-out landing + this email screen.',
      },
    ],
  },
  {
    id: 'question',
    // 3.2 "How social are you?": still in the live flow. 3.1 "What are you
    // looking for?" is hidden on servers with the D104b package (asked in
    // "What you're looking for" instead), so it is not representative.
    title: '2 · Onboarding question (Compatibility 2 of 7)',
    liveSource: 'components/onboarding-v2/PreviewFlow.tsx → components/onboarding-v2/compatibility/CompatibilityFields.tsx · copy in lib/onboardingV2/compatibility.ts',
    states: [
      { id: 'question-empty', label: 'Nothing selected' },
      { id: 'question-selected', label: 'Option selected' },
      { id: 'question-save-error', label: 'Save failed (offline)' },
    ],
  },
  {
    id: 'received',
    title: '3 · Application received / pending',
    liveSource: 'app/v2/status.tsx + components/onboarding-v2/yourProfile/ApplicationFields.tsx',
    states: [
      { id: 'submitted', label: 'Submitted · review pending' },
      { id: 'rejected', label: 'Not accepted' },
      { id: 'status-error', label: 'Status could not load' },
    ],
  },
];

/** Synthetic values only (RFC 2606 example domain, made-up digits). */
export const SYNTHETIC = {
  email: 'alex.sample@example.com',
  code: '123456',
  // The live app shows friendlyNetworkError(...) for an offline save/load.
  offlineMessage: 'No connection. Check your internet and try again.',
} as const;

/** Spec welcome (docs/tempa/ONBOARDING_FLOW.md §1) — status 🟡 copy, not built. */
export const SPEC_WELCOME = {
  headline: 'People, not profiles.',
  body: 'Meet people you connect with. Make plans to meet in real life.',
  primary: 'Get started',
  secondary: 'Log in',
  link: 'How membership works',
} as const;

/**
 * Preview-only copy proposals for the spec welcome. Add an entry to try new
 * wording; the first entry is always the spec text. Nothing here is a product
 * decision — the owner approves any change before it reaches a live screen.
 */
export type WelcomeProposal = { id: string; label: string; headline: string; body: string };

export const WELCOME_PROPOSALS: WelcomeProposal[] = [
  { id: 'spec', label: 'Spec copy', headline: SPEC_WELCOME.headline, body: SPEC_WELCOME.body },
];

export function screenById(id: DesignScreenId): DesignScreen {
  const s = DESIGN_SCREENS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown design screen ${id}`);
  return s;
}

export function screenOfState(state: DesignStateId): DesignScreen {
  const s = DESIGN_SCREENS.find((x) => x.states.some((st) => st.id === state));
  if (!s) throw new Error(`unknown design state ${state}`);
  return s;
}
