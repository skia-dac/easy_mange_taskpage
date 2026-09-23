import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import { minTouchSize, useTheme } from '@/shared/theme';

/** Bouton loupe des en-têtes : ouvre la recherche globale. */
export function SearchButton() {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('search.title')}
      onPress={() => router.push('/search')}
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
      <Feather name="search" size={20} color={colors.text} />
    </Pressable>
  );
}
