// Lets a field inside OnboardingScreen scroll itself (and whatever renders
// right below it, e.g. typeahead suggestions) into the visible area above the
// keyboard and the pinned footer (P05 R1).
import { createContext, useContext, type RefObject } from 'react';
import type { View } from 'react-native';

export type RevealFn = (target: RefObject<View | null>) => void;

export const OnboardingScrollContext = createContext<RevealFn | null>(null);

export function useRevealInScroll(): RevealFn {
  return useContext(OnboardingScrollContext) ?? (() => {});
}

/** Lets a child pause the screen's scrolling (P07 R2: while a photo is being
 * dragged, so the drag and the scroll view never fight). */
export const OnboardingScrollLockContext = createContext<(locked: boolean) => void>(() => {});

export function useScrollLock(): (locked: boolean) => void {
  return useContext(OnboardingScrollLockContext);
}
