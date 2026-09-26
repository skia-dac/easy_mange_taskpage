import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef } from 'react';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTabBarHidden } from '../tabBarVisibility';
import { useTheme } from '../theme';
import { PressableScale } from './PressableScale';

const TURN = { damping: 14, stiffness: 220 };
const POP = { damping: 11, stiffness: 280 };
const SIZE = 58;

function slideY(shift: { value: number }, to: number, duration: number) {
  shift.value = withTiming(to, { duration, easing: Easing.out(Easing.cubic) });
}

/** Bouton rond « + ». `open` le fait tourner d'un quart de tour pour fermer le menu. */
export function PlusButton({
  onPress,
  accessibilityLabel,
  open = false,
  bottomInset = 0,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  open?: boolean;
  /** Espace laissé sous le bouton, pour rester au-dessus de la barre d'onglets. */
  bottomInset?: number;
}) {
  const { colors, radius, spacing } = useTheme();
  const reduced = useReducedMotion();
  const hidden = useTabBarHidden();
  const arrive = useSharedValue(reduced ? 1 : 0);
  const breathe = useSharedValue(1);
  const pop = useSharedValue(1);
  const turn = useSharedValue(open ? 1 : 0);
  const shift = useSharedValue(0);
  const seen = useRef(false);
  const away = hidden && !open;

  useEffect(() => {
    const travel = bottomInset + spacing.xl + SIZE;
    slideY(shift, away ? travel : 0, reduced ? 0 : away ? 160 : 220);
  }, [away, bottomInset, reduced, shift, spacing.xl]);

  useEffect(() => {
    if (reduced) return;
    arrive.value = withSpring(1, { damping: 12, stiffness: 170 });
  }, [arrive, reduced]);

  useEffect(() => {
    if (reduced || open) {
      breathe.value = withTiming(1, { duration: 180 });
      return;
    }
    breathe.value = withRepeat(withTiming(1.06, { duration: 1400 }), -1, true);
  }, [breathe, open, reduced]);

  useEffect(() => {
    const to = open ? 1 : 0;
    if (!seen.current || reduced) {
      seen.current = true;
      turn.value = to;
      return;
    }
    turn.value = withSpring(to, TURN);
    pop.value = withSequence(withSpring(1.1, POP), withSpring(1, TURN));
  }, [open, pop, reduced, turn]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: arrive.value * breathe.value * pop.value }],
  }));
  const colorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(turn.value, [0, 1], [colors.primary, colors.text]),
  }));
  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 45}deg` }],
  }));
  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: shift.value }],
  }));

  return (
    <Animated.View
      pointerEvents={away ? 'none' : 'box-none'}
      accessibilityElementsHidden={away}
      importantForAccessibility={away ? 'no-hide-descendants' : 'auto'}
      style={[
        {
          position: 'absolute',
          right: spacing.xl,
          bottom: spacing.xl + bottomInset,
          zIndex: 2,
        },
        slideStyle,
      ]}
    >
      <Animated.View style={scaleStyle}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded: open }}
          onPress={onPress}
          style={{
            width: SIZE,
            height: SIZE,
            borderRadius: radius.lg,
            overflow: 'hidden',
            elevation: 4,
            shadowColor: colors.text,
            shadowOpacity: 0.2,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
          }}
        >
          <Animated.View
            style={[
              {
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.lg,
              },
              colorStyle,
            ]}
          >
            <Animated.View style={spinStyle}>
              <Feather name="plus" size={28} color={open ? colors.background : colors.onPrimary} />
            </Animated.View>
          </Animated.View>
        </PressableScale>
      </Animated.View>
    </Animated.View>
  );
}
