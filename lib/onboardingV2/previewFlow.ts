// Tempa onboarding V2 — connected dev-preview flow (P02 Basics → P03
// Compatibility → P04 Your Life → P05 Your World → P06 Your Dates → P07 Your Profile). Pure
// navigation/validation over one flat step list; the in-memory drafts live in
// PreviewFlow. Nothing here persists anything.
import { BASICS_TOTAL_STEPS, isStepValid, type BasicsDraft } from '@/lib/onboardingV2/basics';
import { COMPAT_TOTAL_STEPS, isCompatStepValid, type CompatDraft } from '@/lib/onboardingV2/compatibility';
import { YOUR_DATES_TOTAL_STEPS, isDatesStepValid, type DatesDraft } from '@/lib/onboardingV2/yourDates';
import {
  YOUR_PROFILE_TOTAL_STEPS,
  isProfileStepValid,
  type ProfileDraft,
} from '@/lib/onboardingV2/yourProfile';
import { YOUR_LIFE_TOTAL_STEPS, isLifeStepValid, type LifeDraft } from '@/lib/onboardingV2/yourLife';
import { YOUR_WORLD_TOTAL_STEPS, isWorldStepValid, type WorldDraft } from '@/lib/onboardingV2/yourWorld';

export type SectionId = 'basics' | 'compatibility' | 'yourLife' | 'yourWorld' | 'yourDates' | 'yourProfile';

export const SECTIONS: { id: SectionId; label: string; steps: number }[] = [
  { id: 'basics', label: 'Basics', steps: BASICS_TOTAL_STEPS },
  { id: 'compatibility', label: 'Compatibility', steps: COMPAT_TOTAL_STEPS },
  { id: 'yourLife', label: 'Your Life', steps: YOUR_LIFE_TOTAL_STEPS },
  { id: 'yourWorld', label: 'Your World', steps: YOUR_WORLD_TOTAL_STEPS },
  { id: 'yourDates', label: 'Your Dates', steps: YOUR_DATES_TOTAL_STEPS },
  { id: 'yourProfile', label: 'Your Profile', steps: YOUR_PROFILE_TOTAL_STEPS },
];

export type FlowPos = { section: SectionId; step: number }; // step is 1-based, section-local

export const FIRST_POS: FlowPos = { section: 'basics', step: 1 };

function sectionIndex(id: SectionId): number {
  return SECTIONS.findIndex((s) => s.id === id);
}

export function sectionOf(pos: FlowPos) {
  return SECTIONS[sectionIndex(pos.section)];
}

/** Next position, or null when the last step of the last section is done. */
export function nextPos(pos: FlowPos): FlowPos | null {
  const i = sectionIndex(pos.section);
  if (pos.step < SECTIONS[i].steps) return { section: pos.section, step: pos.step + 1 };
  if (i + 1 < SECTIONS.length) return { section: SECTIONS[i + 1].id, step: 1 };
  return null;
}

/** Previous position, or null on the very first step (leave the preview). */
export function prevPos(pos: FlowPos): FlowPos | null {
  const i = sectionIndex(pos.section);
  if (pos.step > 1) return { section: pos.section, step: pos.step - 1 };
  if (i > 0) return { section: SECTIONS[i - 1].id, step: SECTIONS[i - 1].steps };
  return null;
}

export function isPosValid(
  pos: FlowPos,
  basics: BasicsDraft,
  compat: CompatDraft,
  life: LifeDraft,
  world: WorldDraft,
  dates: DatesDraft,
  profile: ProfileDraft,
): boolean {
  if (pos.section === 'basics') return isStepValid(pos.step, basics);
  if (pos.section === 'compatibility') return isCompatStepValid(pos.step, compat);
  if (pos.section === 'yourLife') return isLifeStepValid(pos.step, life);
  if (pos.section === 'yourWorld') return isWorldStepValid(pos.step, world);
  if (pos.section === 'yourDates') return isDatesStepValid(pos.step, dates);
  return isProfileStepValid(pos.step, profile);
}
