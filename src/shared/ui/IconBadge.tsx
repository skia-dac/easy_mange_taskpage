import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { useTheme, type ColorTokens } from '../theme';

type Props = {
  icon: ComponentProps<typeof Feather>['name'];
  color?: keyof ColorTokens;
  background?: keyof ColorTokens;
  size?: number;
};

/** Icône dans un carré arrondi coloré. */
export function IconBadge({
  icon,
  color = 'primary',
  background = 'primarySoft',
  size = 36,
}: Props) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.sm,
        backgroundColor: colors[background],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather name={icon} size={size * 0.5} color={colors[color]} />
    </View>
  );
}
