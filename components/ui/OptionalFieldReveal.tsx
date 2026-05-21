// Screen: Opsiyonel alan reveal | Status: stable | Last updated: Mayıs 2026
import type { ReactNode } from 'react';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

type Props = {
  show: boolean;
  /** Remount + replay enter animation when this changes */
  animationKey: string;
  children: ReactNode;
};

/** Optional form field: opacity + layout transition (300ms). */
export function OptionalFieldReveal({ show, animationKey, children }: Props) {
  if (!show) return null;
  return (
    <Animated.View
      key={animationKey}
      layout={LinearTransition.duration(300)}
      entering={FadeIn.duration(300)}
      exiting={FadeOut.duration(200)}>
      {children}
    </Animated.View>
  );
}
