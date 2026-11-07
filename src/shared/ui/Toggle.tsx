import { Platform, Switch, type SwitchProps } from 'react-native';

import { haptic } from '../haptics';
import { useTheme, type ColorTokens } from '../theme';

type Props = Omit<SwitchProps, 'trackColor' | 'thumbColor' | 'ios_backgroundColor'> & {
  /** Couleur quand l'interrupteur est allumé (vert par défaut ; rouge pour « Ça m'empêche… »). */
  tone?: keyof Pick<ColorTokens, 'success' | 'danger' | 'primary'>;
};

/**
 * Interrupteur de l'app, aux couleurs du thème en clair et en sombre. Éteint, son rail garde un
 * contraste de 3:1 (on le voit sur une carte sombre). Chaque bascule se sent sous le doigt.
 */
export function Toggle({ tone = 'success', onValueChange, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <Switch
      trackColor={{ true: colors[tone], false: colors.outline }}
      ios_backgroundColor={colors.outline}
      thumbColor={Platform.OS === 'android' ? colors.surface : undefined}
      onValueChange={
        onValueChange
          ? (value) => {
              haptic('selection');
              void onValueChange(value);
            }
          : undefined
      }
      {...rest}
    />
  );
}
