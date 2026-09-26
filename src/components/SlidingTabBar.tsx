import { useEffect } from 'react';
import {
  BottomTabBar,
  type BottomTabBarProps,
} from 'expo-router/build/react-navigation/bottom-tabs';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useSetTabBarScrolling, useTabBarHidden } from '@/shared/tabBarVisibility';

function slideTo(progress: { value: number }, to: number, duration: number) {
  progress.value = withTiming(to, { duration, easing: Easing.out(Easing.cubic) });
}

function rememberHeight(distance: { value: number }, height: number) {
  distance.value = height;
}

/** La barre d'onglets glisse hors de l'écran pendant le défilement, puis revient à l'arrêt. */
export function SlidingTabBar(props: BottomTabBarProps) {
  const hidden = useTabBarHidden();
  const setScrolling = useSetTabBarScrolling();
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);
  const distance = useSharedValue(96);
  const index = props.state.index;

  useEffect(() => {
    setScrolling(false);
  }, [index, setScrolling]);

  useEffect(() => {
    slideTo(progress, hidden ? 1 : 0, reduced ? 0 : hidden ? 160 : 220);
  }, [hidden, progress, reduced]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * distance.value }],
  }));

  return (
    <Animated.View
      pointerEvents={hidden ? 'none' : 'box-none'}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      onLayout={(event) => rememberHeight(distance, event.nativeEvent.layout.height)}
      style={[{ position: 'absolute', left: 0, right: 0, bottom: 0 }, style]}
    >
      <BottomTabBar {...props} />
    </Animated.View>
  );
}
