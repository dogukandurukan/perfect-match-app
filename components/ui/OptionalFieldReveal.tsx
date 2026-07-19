import type { ReactNode } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';

type OptionalFieldRevealProps = {
  show: boolean;
  animationKey: string;
  children: ReactNode;
};

/** Conditionally reveals children with a short fade-in keyed by `animationKey`. */
export function OptionalFieldReveal({ show, animationKey, children }: OptionalFieldRevealProps) {
  if (!show) return null;

  return (
    <Animated.View key={animationKey} entering={FadeIn.duration(220)}>
      {children}
    </Animated.View>
  );
}
