import Feather from '@expo/vector-icons/Feather';
import { Redirect, Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';

import { isOnboardingDone } from '@/modules/identity';
import { useDb } from '@/shared/db';
import { useSpaces } from '@/shared/SpacesContext';
import { fonts, useTheme } from '@/shared/theme';
import { LoadingScreen } from '@/shared/ui';

type IconName = ComponentProps<typeof Feather>['name'];

function tabIcon(name: IconName) {
  function TabIcon({ color, size }: { color: ColorValue; size: number }) {
    return <Feather name={name} size={size} color={color} />;
  }
  return TabIcon;
}

/**
 * Les 5 onglets : Aujourd'hui · Calendrier · Tâches · Notes · Argent.
 * Le Profil s'ouvre avec la photo en haut à droite d'Aujourd'hui.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const db = useDb();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const spaces = useSpaces();
  // Études seul : « Calendrier » ; dès qu'il y a Pro ou Perso : « Planning ».
  const calendarTitle =
    spaces.active.length === 1 && spaces.has('study') ? t('tabs.calendar') : t('tabs.planning');

  useEffect(() => {
    void isOnboardingDone(db).then(setOnboarded, () => setOnboarded(true));
  }, [db]);

  if (onboarded === null) return <LoadingScreen />;
  if (!onboarded) return <Redirect href="/onboarding" />;

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
        options={{ title: calendarTitle, tabBarIcon: tabIcon('calendar') }}
      />
      <Tabs.Screen
        name="tasks"
        options={{ title: t('tabs.tasks'), tabBarIcon: tabIcon('check-square') }}
      />
      <Tabs.Screen
        name="notes"
        options={{ title: t('tabs.notes'), tabBarIcon: tabIcon('file-text') }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: t('tabs.money'),
          tabBarIcon: tabIcon('credit-card'),
          // L'argent fait partie de l'espace Perso : l'onglet est caché (les données restent).
          href: spaces.has('personal') ? undefined : null,
        }}
      />
    </Tabs>
  );
}
