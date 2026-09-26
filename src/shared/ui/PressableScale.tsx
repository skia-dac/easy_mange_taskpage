import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const SPRING = { damping: 16, stiffness: 380 };

function springTo(scale: { value: number }, to: number) {
  scale.value = withSpring(to, SPRING);
}

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
};

/** Bouton qui se tasse légèrement sous le doigt, puis revient. */
export function PressableScale({ style, onPressIn, onPressOut, children, ...rest }: Props) {
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={animated}>
      <Pressable
        onPressIn={(event) => {
          if (!reduced) springTo(scale, 0.96);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          springTo(scale, 1);
          onPressOut?.(event);
        }}
        style={style}
        {...rest}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
