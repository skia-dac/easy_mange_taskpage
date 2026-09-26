import { createContext, useContext, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

/** Écart entre deux lignes, et plafond pour qu'une longue liste ne dure pas des secondes. */
const STAGGER_STEP_MS = 40;
const STAGGER_CAP = 8;

export function staggerDelay(index: number): number {
  return Math.min(Math.max(index, 0), STAGGER_CAP) * STAGGER_STEP_MS;
}

const StaggerContext = createContext<(() => number) | null>(null);

/**
 * Les `RiseIn` descendants entrent l'un après l'autre, dans l'ordre de l'affichage.
 * Le compteur repart à zéro à chaque rendu du groupe, pour que l'ordre reste stable.
 */
export function StaggerGroup({ children }: { children: ReactNode }) {
  // Compteur lu tout de suite par les RiseIn de ce rendu, dans l'ordre de l'arbre.
  // Un state relancerait l'apparition de chaque ligne à chaque incrément.
  const seq = { n: 0 };
  /* eslint-disable react-hooks/immutability -- consommation synchrone pendant le rendu des enfants */
  const take = () => staggerDelay(seq.n++);
  return <StaggerContext.Provider value={take}>{children}</StaggerContext.Provider>;
  /* eslint-enable react-hooks/immutability */
}

type Props = {
  children: ReactNode;
  /** Décalage en millisecondes. Sans valeur, le groupe autour en donne un. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
};

/** Apparition courte : le contenu monte un peu et devient net. Rien si les animations sont coupées. */
export function RiseIn({ children, delay, style }: Props) {
  const reduced = useReducedMotion();
  const take = useContext(StaggerContext);
  const ms = delay ?? take?.() ?? 0;
  if (reduced) return <View style={style}>{children}</View>;
  return (
    <Animated.View
      entering={FadeInDown.duration(380).delay(ms).springify().damping(18).stiffness(170)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}
