import Feather from '@expo/vector-icons/Feather';
import { useEffect, type ComponentProps, type ReactNode } from 'react';
import type { ColorValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

export type IconName = ComponentProps<typeof Feather>['name'];

type TabIconProps = { color: ColorValue; size: number; focused: boolean };

/**
 * Icône d'onglet qui grossit un peu quand l'onglet est actif (rien si les animations sont
 * réduites). Un seul composant, déclaré une fois : recréé à chaque rendu, il serait remonté (et
 * son animation relancée) à chaque fois.
 */
export function TabIcon({ name, color, size, focused }: TabIconProps & { name: IconName }) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(focused && !reduced ? 1.12 : 1);
  useEffect(() => {
    scale.value = withSpring(reduced || !focused ? 1 : 1.12, { damping: 12, stiffness: 220 });
  }, [focused, reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style}>
      <Feather name={name} size={size} color={color} />
    </Animated.View>
  );
}

/** Fonctions `tabBarIcon`, créées une fois par icône (options stables d'un rendu à l'autre). */
const tabIcons = new Map<IconName, (props: TabIconProps) => ReactNode>();

export function tabIcon(name: IconName) {
  let render = tabIcons.get(name);
  if (!render) {
    render = (props: TabIconProps) => <TabIcon name={name} {...props} />;
    tabIcons.set(name, render);
  }
  return render;
}
