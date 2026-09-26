import { useContext, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useTabBarHidden, useTabBarInset } from '../tabBarVisibility';
import { useTheme } from '../theme';

const TURN = { damping: 14, stiffness: 220 };
const POP = { damping: 11, stiffness: 280 };
const SIZE = 58;

/** Place à laisser en bas d'une liste pour que le « + » ne cache jamais la dernière ligne. */
export const FAB_CLEARANCE = 96;

/**
 * Espace sous le bouton : celui demandé ; sinon la hauteur de la barre d'onglets
 * (elle recouvre le bas de l'écran) et, hors des onglets, la barre d'accueil de l'iPhone.
 */
export function usePlusButtonInset(bottomInset?: number) {
  const tabBar = useTabBarInset();
  const homeIndicator = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  if (bottomInset !== undefined) return bottomInset;
  return tabBar > 0 ? tabBar : homeIndicator;
}

const SLIDE = Easing.bezier(0.33, 1, 0.68, 1);
const PRESS = { damping: 16, stiffness: 380 };

const Mark = Animated.createAnimatedComponent(G);

/** Croix dessinée en vecteur : elle tourne dans le dessin, le zoom ne la pixellise pas. */
function PlusMark({ color, turn }: { color: string; turn: SharedValue<number> }) {
  const spin = useAnimatedProps(() => ({
    rotation: turn.value * 45,
  }));
  return (
    <Svg width={28} height={28} viewBox="0 0 28 28">
      <Mark animatedProps={spin} origin="14, 14">
        <Path
          d="M14 5.5 V22.5 M5.5 14 H22.5"
          stroke={color}
          strokeWidth={2.6}
          strokeLinecap="round"
        />
      </Mark>
    </Svg>
  );
}

function slideY(shift: { value: number }, to: number, duration: number) {
  shift.value = withTiming(to, { duration, easing: SLIDE });
}

function pressTo(scale: { value: number }, to: number) {
  scale.value = withSpring(to, PRESS);
}

/**
 * Bouton rond « + », au même endroit sur tous les écrans. `open` le fait tourner d'un quart de
 * tour pour fermer le menu.
 */
export function PlusButton({
  onPress,
  accessibilityLabel,
  open = false,
  bottomInset: requestedInset,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  open?: boolean;
  /**
   * Espace laissé sous le bouton, pour rester au-dessus de la barre d'onglets. Par défaut :
   * la hauteur de cette barre dans les onglets, la barre d'accueil de l'iPhone ailleurs.
   */
  bottomInset?: number;
}) {
  const { colors, radius, spacing } = useTheme();
  const reduced = useReducedMotion();
  const hidden = useTabBarHidden();
  const bottomInset = usePlusButtonInset(requestedInset);
  const arrive = useSharedValue(reduced ? 1 : 0);
  const breathe = useSharedValue(1);
  const pop = useSharedValue(1);
  const press = useSharedValue(1);
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
    transform: [{ scale: arrive.value * breathe.value * pop.value * press.value }],
  }));
  const colorStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(turn.value, [0, 1], [colors.primary, colors.text]),
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: open }}
        onPress={onPress}
        onPressIn={() => {
          if (!reduced) pressTo(press, 0.96);
        }}
        onPressOut={() => pressTo(press, 1)}
        style={{
          width: SIZE,
          height: SIZE,
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
              ...StyleSheet.absoluteFill,
              borderRadius: radius.lg,
            },
            colorStyle,
            scaleStyle,
          ]}
        />
        <View pointerEvents="none" style={styles.mark}>
          <PlusMark color={open ? colors.background : colors.onPrimary} turn={turn} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mark: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
