import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { subjectColors, useTheme } from '@/shared/theme';

type Props = { icon: string; colorId: string; size?: number };

/** Icône d'une habitude dans un carré arrondi de sa couleur (palette des matières). */
export function HabitIcon({ icon, colorId, size = 38 }: Props) {
  const { radius, scheme } = useTheme();
  const c = subjectColors.find((x) => x.id === colorId) ?? subjectColors[0]!;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        backgroundColor: scheme === 'dark' ? c.softDark : c.soft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather
        name={icon as ComponentProps<typeof Feather>['name']}
        size={Math.round(size * 0.5)}
        color={scheme === 'dark' ? c.strongDark : c.strong}
      />
    </View>
  );
}
