import type { PressableProps, StyleProp, ViewStyle } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  style?: StyleProp<ViewStyle>;
  /** `secondary` : bouton clair avec bordure (action secondaire, ex. « Continuer avec Google »). */
  variant?: 'primary' | 'secondary';
};

/**
 * Bouton principal. Zone touchable d'au moins 44 pt (accessibilité). Désactivé, il passe au gris
 * (texte encore lisible, contraste ≥ 4,5:1) et le lecteur d'écran dit « estompé » / « désactivé ».
 */
export function Button({
  label,
  style,
  variant = 'primary',
  disabled,
  accessibilityState,
  ...rest
}: Props) {
  const secondary = variant === 'secondary';
  const off = !!disabled;
  const { colors, radius, spacing } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, disabled: off }}
      disabled={disabled}
      style={[
        {
          minHeight: minTouchSize + 8,
          borderRadius: radius.md,
          paddingHorizontal: spacing.xl,
          // Grand texte : le libellé passe à la ligne et le bouton grandit avec lui.
          paddingVertical: spacing.sm,
          backgroundColor: off ? colors.disabled : secondary ? colors.surface : colors.primary,
          borderWidth: secondary ? 1.5 : 0,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      {...rest}
    >
      <AppText
        variant="bodyStrong"
        color={off ? 'muted' : secondary ? 'text' : 'onPrimary'}
        style={{ textAlign: 'center' }}
      >
        {label}
      </AppText>
    </PressableScale>
  );
}
