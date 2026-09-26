import { useEffect, useRef, type ReactNode } from 'react';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const POP = { damping: 12, stiffness: 280 };
const SETTLE = { damping: 18, stiffness: 220 };

/**
 * La case grossit un court instant quand elle passe à coché, puis revient.
 * Décocher fait le mouvement inverse.
 */
export function CheckPop({ checked, children }: { checked: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const prev = useRef(checked);

  useEffect(() => {
    if (prev.current === checked) return;
    const turnedOn = checked && !prev.current;
    prev.current = checked;
    if (reduced) {
      scale.value = 1;
      return;
    }
    scale.value = turnedOn
      ? withSequence(withSpring(1.16, POP), withSpring(1, POP))
      : withSequence(withTiming(0.88, { duration: 100 }), withSpring(1, POP));
  }, [checked, reduced, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * Une ligne terminée se pose : un peu plus petite, un peu plus douce.
 * Annuler ramène la ligne à sa taille.
 */
export function Settle({ done, children }: { done: boolean; children: ReactNode }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(done && !reduced ? 0.98 : 1);
  const opacity = useSharedValue(done && !reduced ? 0.72 : 1);
  const prev = useRef(done);

  useEffect(() => {
    if (reduced) {
      scale.value = 1;
      opacity.value = 1;
      prev.current = done;
      return;
    }
    if (prev.current === done) return;
    prev.current = done;
    scale.value = withSpring(done ? 0.98 : 1, SETTLE);
    opacity.value = withTiming(done ? 0.72 : 1, { duration: 220 });
  }, [done, opacity, reduced, scale]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  if (reduced) return <>{children}</>;
  return <Animated.View style={style}>{children}</Animated.View>;
}
