import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import type { MoneyCategory } from '@/modules/finance';
import { subjectColors, useTheme } from '@/shared/theme';

/** Pastille d'une catégorie d'argent : son icône sur sa couleur douce. */
export function CategoryBadge({
  category,
  size = 40,
}: {
  category: MoneyCategory | undefined;
  size?: number;
}) {
  const { scheme } = useTheme();
  const c =
    subjectColors.find((x) => x.id === category?.colorId) ??
    subjectColors[subjectColors.length - 1]!;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.32,
        backgroundColor: scheme === 'dark' ? c.softDark : c.soft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather
        name={(category?.icon ?? 'tag') as ComponentProps<typeof Feather>['name']}
        size={size * 0.48}
        color={scheme === 'dark' ? c.strongDark : c.strong}
      />
    </View>
  );
}
