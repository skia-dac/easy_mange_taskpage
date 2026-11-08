import { useContext, useEffect, useRef } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { haptic } from './haptics';
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
/** Sous le doigt : le bouton s'enfonce vite, puis rebondit un peu en revenant. */
const PRESS_IN = { damping: 20, stiffness: 520 };
const PRESS_OUT = { damping: 11, stiffness: 300 };
const PRESSED_SCALE = 0.9;
/** Une seule arrivée, discrète : le bouton grandit un peu jusqu'à sa taille (rien si animations coupées). */
const ARRIVE_FROM = 0.85;
const ARRIVE = { damping: 18, stiffness: 200 };

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
  scale.value = withSpring(to, to < 1 ? PRESS_IN : PRESS_OUT);
}

/**
 * Bouton rond « + », au même endroit sur tous les écrans. `open` le fait tourner d'un quart de
 * tour pour fermer le menu.
 *
 * Le lecteur d'écran n'entend « replié / déployé » que si le bouton ouvre un menu (`open` ou
 * `menuOpen` donné). Un + qui crée directement reste un simple bouton.
 */
export function PlusButton({
  onPress,
  accessibilityLabel,
  open: openProp,
  menuOpen,
  bottomInset: requestedInset,
  overlay = false,
}: {
  onPress: () => void;
  accessibilityLabel: string;
  /** Menu attaché au bouton (il tourne en croix quand le menu est ouvert). */
  open?: boolean;
  /** Le bouton ouvre une fenêtre de choix, sans tourner : état annoncé au lecteur d'écran. */
  menuOpen?: boolean;
  /**
   * Espace laissé sous le bouton, pour rester au-dessus de la barre d'onglets. Par défaut :
   * la hauteur de cette barre dans les onglets, la barre d'accueil de l'iPhone ailleurs.
   */
  bottomInset?: number;
  /**
   * Copie du bouton posée au même endroit dans la fenêtre d'un menu (au-dessus de son voile) :
   * pas d'animation d'arrivée, et le passage de + à × se voit dès qu'elle apparaît.
   */
  overlay?: boolean;
}) {
  const { colors, radius, spacing, scheme } = useTheme();
  const reduced = useReducedMotion();
  const hidden = useTabBarHidden();
  const bottomInset = usePlusButtonInset(requestedInset);
  const open = openProp ?? false;
  const expanded = openProp ?? menuOpen;
  const arrive = useSharedValue(reduced || overlay ? 1 : ARRIVE_FROM);
  const pop = useSharedValue(1);
  const press = useSharedValue(1);
  const turn = useSharedValue(open && !overlay ? 1 : 0);
  const shift = useSharedValue(0);
  const seen = useRef(overlay);
  // La copie posée sur un menu reste toujours là (le menu est ouvert).
  const away = hidden && !open && !overlay;

  useEffect(() => {
    const travel = bottomInset + spacing.xl + SIZE;
    slideY(shift, away ? travel : 0, reduced ? 0 : away ? 160 : 220);
  }, [away, bottomInset, reduced, shift, spacing.xl]);

  useEffect(() => {
    arrive.value = reduced ? 1 : withSpring(1, ARRIVE);
  }, [arrive, reduced]);

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
    transform: [{ scale: arrive.value * pop.value * press.value }],
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
        accessibilityState={expanded === undefined ? undefined : { expanded }}
        onPress={() => {
          haptic('selection');
          onPress();
        }}
        onPressIn={() => {
          if (!reduced) pressTo(press, PRESSED_SCALE);
        }}
        onPressOut={() => pressTo(press, 1)}
        style={({ pressed }) => ({
          width: SIZE,
          height: SIZE,
          // Animations coupées : il s'assombrit un peu au lieu de s'enfoncer.
          opacity: reduced && pressed ? 0.85 : 1,
          // Ombre (iOS) : noire en mode sombre, jamais un halo clair.
          shadowColor: colors.shadow,
          shadowOpacity: scheme === 'dark' ? 0.5 : 0.22,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
        })}
      >
        <Animated.View
          style={[
            {
              ...StyleSheet.absoluteFill,
              borderRadius: radius.lg,
              // Android : l'élévation suit la forme colorée (une vue sans fond n'a pas d'ombre).
              elevation: Platform.OS === 'android' ? 6 : 0,
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
