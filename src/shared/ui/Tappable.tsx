import { forwardRef } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  type View,
  type ViewStyle,
} from 'react-native';

import { pressedOpacity, useTheme } from '../theme';

type Props = PressableProps & {
  /**
   * Retour sous le doigt. `opacity` (par défaut) : s'éclaircit sur iOS, onde Material sur
   * Android. `none` : rien (fond d'une fenêtre, zone qui ne fait qu'arrêter un toucher).
   */
  feedback?: 'opacity' | 'none';
  /** Onde sans bord (bouton icône rond, sans fond) : elle déborde en cercle comme sur Android. */
  borderless?: boolean;
};

const android = Platform.OS === 'android';

function resolve(
  style: PressableProps['style'],
  state: PressableStateCallbackType,
): StyleProp<ViewStyle> {
  return typeof style === 'function' ? style(state) : style;
}

/**
 * Zone touchable de l'app : même retour partout. Sur iOS l'élément s'éclaircit sous le doigt,
 * sur Android il montre l'onde Material, coupée aux coins arrondis.
 */
export const Tappable = forwardRef<View, Props>(function Tappable(
  { style, feedback = 'opacity', borderless = false, android_ripple, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const on = feedback !== 'none';
  const ripple =
    android_ripple ??
    (on ? { color: colors.ripple, borderless, foreground: !borderless } : undefined);
  return (
    <Pressable
      ref={ref}
      android_ripple={ripple}
      style={(state) => {
        const base = resolve(style, state);
        if (android) {
          // L'onde suit les coins arrondis seulement si la vue coupe son contenu.
          const flat = StyleSheet.flatten(base);
          return on && !borderless && flat?.borderRadius ? [base, { overflow: 'hidden' }] : base;
        }
        return on && state.pressed ? [base, { opacity: pressedOpacity }] : base;
      }}
      {...rest}
    />
  );
});
