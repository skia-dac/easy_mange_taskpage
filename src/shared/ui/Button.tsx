import { Pressable, type PressableProps } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';

type Props = Omit<PressableProps, 'children'> & {
  label: string;
  /** `secondary` : bouton clair avec bordure (action secondaire, ex. « Continuer avec Google »). */
  variant?: 'primary' | 'secondary';
};

/** Bouton principal. Zone touchable d'au moins 44 pt (accessibilité). */
export function Button({ label, style, variant = 'primary', ...rest }: Props) {
  const secondary = variant === 'secondary';
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      style={(state) => [
        {
          minHeight: minTouchSize + 8,
          borderRadius: radius.md,
          paddingHorizontal: spacing.xl,
          backgroundColor: secondary ? colors.surface : colors.primary,
          borderWidth: secondary ? 1.5 : 0,
          borderColor: colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: state.pressed ? 0.85 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <AppText variant="bodyStrong" color={secondary ? 'text' : 'onPrimary'}>
        {label}
      </AppText>
    </Pressable>
  );
}
