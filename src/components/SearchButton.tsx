import Feather from '@expo/vector-icons/Feather';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { minTouchSize, useTheme } from '@/shared/theme';

type Props = { icon: ComponentProps<typeof Feather>['name']; label: string; href: Href };

/** Bouton rond des en-têtes d'onglet (recherche, notifications…). */
export function HeaderButton({ icon, label, href }: Props) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => router.push(href)}
      style={({ pressed }) => ({
        width: minTouchSize,
        height: minTouchSize,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Feather name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

/** Bouton loupe : ouvre la recherche globale. */
export function SearchButton() {
  const { t } = useTranslation();
  return <HeaderButton icon="search" label={t('search.title')} href="/search" />;
}
