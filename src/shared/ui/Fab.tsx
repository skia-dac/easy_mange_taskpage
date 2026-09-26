import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme';
import { PressableScale } from './PressableScale';

const TURN = { damping: 14, stiffness: 220 };
const POP = { damping: 11, stiffness: 280 };

/** Bouton rond « + » en bas à droite (ajout rapide). `open` le fait tourner en croix. */
export function Fab({
  onPress,
  accessibilityLabel,
  open = false,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  /** Menu ouvert : le + tourne d’un quart et le bouton fonce, pour fermer. */
  open?: boolean;
}) {
  const { colors, radius, spacing } = useTheme();
  const reduced = useReducedMotion();
  const arrive = useSharedValue(reduced ? 1 : 0);
  const breathe = useSharedValue(1);
  const pop = useSharedValue(1);
  const turn = useSharedValue(open ? 1 : 0);
  const seen = useRef(false);

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

  const motion = useAnimatedStyle(() => ({
    transform: [{ scale: arrive.value * breathe.value * pop.value }],
  }));
  const body = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(turn.value, [0, 1], [colors.primary, colors.text]),
  }));
  const icon = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 45}deg` }],
  }));

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', right: spacing.xl, bottom: spacing.xl, zIndex: 2 }}
    >
      <Animated.View style={motion}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ expanded: open }}
          onPress={onPress}
          style={{
            width: 58,
            height: 58,
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
              body,
            ]}
          >
            <Animated.View style={icon}>
              <Feather name="plus" size={28} color={open ? colors.background : colors.onPrimary} />
            </Animated.View>
          </Animated.View>
        </PressableScale>
      </Animated.View>
    </View>
  );
}
