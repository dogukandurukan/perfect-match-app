// Tempa onboarding V2 — connected dev-preview flow (P02 Basics → P03
// Compatibility). Pure navigation/validation over one flat step list; the
// in-memory drafts live in PreviewFlow. Nothing here persists anything.
import { BASICS_TOTAL_STEPS, isStepValid, type BasicsDraft } from '@/lib/onboardingV2/basics';
import { COMPAT_TOTAL_STEPS, isCompatStepValid, type CompatDraft } from '@/lib/onboardingV2/compatibility';

export type SectionId = 'basics' | 'compatibility';

export const SECTIONS: { id: SectionId; label: string; steps: number }[] = [
  { id: 'basics', label: 'Basics', steps: BASICS_TOTAL_STEPS },
  { id: 'compatibility', label: 'Compatibility', steps: COMPAT_TOTAL_STEPS },
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

export function isPosValid(pos: FlowPos, basics: BasicsDraft, compat: CompatDraft): boolean {
  return pos.section === 'basics' ? isStepValid(pos.step, basics) : isCompatStepValid(pos.step, compat);
}
