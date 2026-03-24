import type { ReactNode } from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

type Props = {
  show: boolean;
  /** Remount + replay enter animation when this changes */
  animationKey: string;
  children: ReactNode;
};

/** Optional form field that fades/slides in when `show` becomes true. */
export function OptionalFieldReveal({ show, animationKey, children }: Props) {
  if (!show) return null;
  return (
    <Animated.View entering={FadeInDown.duration(220)} key={animationKey}>
      {children}
    </Animated.View>
  );
}
