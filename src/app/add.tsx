import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';

import { minTouchSize, useTheme, type ColorTokens } from '@/shared/theme';
import { AppText } from '@/shared/ui';

type Tile = {
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
  color: keyof ColorTokens;
  background: keyof ColorTokens;
  href: Href;
};

/** Ajout rapide (§12, §39) : une date peut être transmise depuis le calendrier. */
export default function AddScreen() {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const withDate = date ? { date } : {};

  const tiles: Tile[] = [
    {
      label: t('add.assignment'),
      icon: 'book',
      color: 'primary',
      background: 'primarySoft',
      href: { pathname: '/work/form', params: { kind: 'assignment', ...withDate } },
    },
    {
      label: t('add.task'),
      icon: 'check-square',
      color: 'success',
      background: 'successSoft',
      href: { pathname: '/work/form', params: { kind: 'task', ...withDate } },
    },
    {
      label: t('add.exam'),
      icon: 'award',
      color: 'danger',
      background: 'dangerSoft',
      href: { pathname: '/exams/form', params: withDate },
    },
    {
      label: t('add.event'),
      icon: 'star',
      color: 'warning',
      background: 'warningSoft',
      href: { pathname: '/events/form', params: withDate },
    },
    {
      label: t('add.course'),
      icon: 'clock',
      color: 'primary',
      background: 'primarySoft',
      href: { pathname: '/courses/form', params: withDate },
    },
    {
      label: t('add.subject'),
      icon: 'book-open',
      color: 'primary',
      background: 'primarySoft',
      href: '/subjects/form',
    },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.xl }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {tiles.map((tile) => (
          <Pressable
            key={tile.label}
            accessibilityRole="button"
            onPress={() => router.replace(tile.href)}
            style={({ pressed }) => ({
              width: '30.5%',
              minHeight: minTouchSize * 2.4,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.sm,
              opacity: pressed ? 0.8 : 1,
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
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}
