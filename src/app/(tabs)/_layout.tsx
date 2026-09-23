import Feather from '@expo/vector-icons/Feather';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { fonts, useTheme } from '@/shared/theme';

type IconName = ComponentProps<typeof Feather>['name'];

function tabIcon(name: IconName) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Feather name={name} size={size} color={color} />;
  }
  return TabIcon;
}

/** Les 5 onglets validés : Aujourd'hui · Calendrier · Notes · Tâches · Profil. */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.bodySemiBold, fontSize: 11 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.today'), tabBarIcon: tabIcon('sun') }} />
      <Tabs.Screen
        name="calendar"
        options={{ title: t('tabs.calendar'), tabBarIcon: tabIcon('calendar') }}
      />
      <Tabs.Screen
        name="notes"
        options={{ title: t('tabs.notes'), tabBarIcon: tabIcon('file-text') }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: t('tabs.tasks'), tabBarIcon: tabIcon('check-square') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabs.profile'), tabBarIcon: tabIcon('user') }}
      />
    </Tabs>
  );
}
