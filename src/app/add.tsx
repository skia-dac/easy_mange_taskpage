import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { itemLooks, type ItemLook } from '@/components/itemTypes';
import { minTouchSize, useTheme } from '@/shared/theme';
import { useSpaces } from '@/shared/SpacesContext';
import { AppText, EmptyState, Tappable } from '@/shared/ui';

type Tile = ItemLook & {
  label: string;
  /** Réservé à l'espace Études (masqué sinon). */
  study?: boolean;
  href: Href;
};

/** « Autre » du + (§12, §39) : examen, cours, matière ; une date peut venir du calendrier. */
export default function AddScreen() {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const withDate = date ? { date } : {};
  const study = useSpaces().has('study');

  // « Autre » du + : seulement ce que le menu n'a pas déjà (note, tâche et rendez-vous y sont).
  const tiles: Tile[] = [
    {
      label: t('add.exam'),
      study: true,
      ...itemLooks.exam,
      href: { pathname: '/exams/form', params: withDate },
    },
    {
      label: t('add.course'),
      study: true,
      ...itemLooks.course,
      href: { pathname: '/courses/form', params: withDate },
    },
    {
      label: t('add.subject'),
      study: true,
      ...itemLooks.subject,
      href: '/subjects/form',
    },
  ];

  const shown = tiles.filter((tile) => study || !tile.study);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.xl }}
    >
      {/* Lien ou widget ancien sans l'espace Études : jamais une grille vide sans explication. */}
      {shown.length === 0 ? (
        <EmptyState
          icon="plus-circle"
          title={t('add.emptyTitle')}
          message={t('add.emptyMessage')}
          action={{ label: t('add.emptyAction'), onPress: () => router.back() }}
        />
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {shown.map((tile) => (
          <Tappable
            key={tile.label}
            accessibilityRole="button"
            onPress={() => router.replace(tile.href)}
            style={() => ({
              width: '30.5%',
              minHeight: minTouchSize * 2.4,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
            })}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.md,
                backgroundColor: colors[tile.background],
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name={tile.icon} size={24} color={colors[tile.color]} />
            </View>
            <AppText variant="bodyStrong">{tile.label}</AppText>
          </Tappable>
        ))}
      </View>
    </ScrollView>
  );
}
