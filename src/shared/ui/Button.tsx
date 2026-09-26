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

/** Bouton principal. Zone touchable d'au moins 44 pt (accessibilité). */
export function Button({ label, style, variant = 'primary', ...rest }: Props) {
  const secondary = variant === 'secondary';
  const { colors, radius, spacing } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      style={[
        {
          minHeight: minTouchSize + 8,
          borderRadius: radius.md,
          paddingHorizontal: spacing.xl,
          backgroundColor: secondary ? colors.surface : colors.primary,
          borderWidth: secondary ? 1.5 : 0,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
      {...rest}
    >
      <AppText variant="bodyStrong" color={secondary ? 'text' : 'onPrimary'}>
        {label}
      </AppText>
    </PressableScale>
  );
}
