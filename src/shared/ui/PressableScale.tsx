import {
  Platform,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { pressedOpacity, pressedScale, useTheme } from '../theme';

const SPRING = { damping: 16, stiffness: 380 };

function springTo(scale: { value: number }, to: number) {
  scale.value = withSpring(to, SPRING);
}

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
};

const android = Platform.OS === 'android';

/**
 * Carte ou bouton qui se tasse légèrement sous le doigt, puis revient ; onde Material en plus
 * sur Android. Animations coupées : il s'éclaircit seulement.
 */
export function PressableScale({ style, onPressIn, onPressOut, children, ...rest }: Props) {
  const reduced = useReducedMotion();
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animated}>
      <Pressable
        android_ripple={{ color: colors.ripple, foreground: true }}
        onPressIn={(event) => {
          if (!reduced) springTo(scale, pressedScale);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          springTo(scale, 1);
          onPressOut?.(event);
        }}
        style={({ pressed }) => [
          style,
          // L'onde suit les coins arrondis seulement si la vue coupe son contenu.
          android ? { overflow: 'hidden' } : null,
          reduced && pressed && !android ? { opacity: pressedOpacity } : null,
        ]}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
