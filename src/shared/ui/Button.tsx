import { Pressable, type PressableProps } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';

type Props = Omit<PressableProps, 'children'> & { label: string };

/** Bouton principal. Zone touchable d'au moins 44 pt (accessibilité). */
export function Button({ label, style, ...rest }: Props) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      style={(state) => [
        {
          minHeight: minTouchSize + 8,
          borderRadius: radius.md,
          paddingHorizontal: spacing.xl,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: state.pressed ? 0.85 : 1,
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      <AppText variant="bodyStrong" color="onPrimary">
        {label}
      </AppText>
    </Pressable>
  );
}
