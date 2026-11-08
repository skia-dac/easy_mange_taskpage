import { Redirect, Tabs } from 'expo-router';
import { Easing } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { isOnboardingDone } from '@/modules/identity';
import { settingTable, useLiveQuery } from '@/shared/db';
import { useSpaces } from '@/shared/SpacesContext';
import { SlidingTabBar } from '@/components/SlidingTabBar';
import { tabIcon } from '@/components/TabIcon';
import { TabBarVisibility } from '@/shared/tabBarVisibility';
import { fonts, textVariants, useTheme } from '@/shared/theme';
import { LoadingScreen } from '@/shared/ui';

/**
 * Les 4 onglets : Aujourd'hui · Calendrier · Carnet (tâches + notes) · Argent.
 * Le Profil s'ouvre avec la photo en haut à droite de chaque onglet.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  // Relu à chaque changement des réglages : l'accueil tout juste terminé est vu tout de suite,
  // même si cet écran est resté monté pendant l'accueil (jamais de retour en boucle).
  const onboarding = useLiveQuery(isOnboardingDone, [settingTable('onboarding_done')], []);
  const spaces = useSpaces();
  // Un seul nom, quels que soient les espaces : « Calendrier » (onglet et titre de l'écran).
  // « Mon planning » reste le nom des créneaux fixes (/planning), ouvert depuis le calendrier.
  const calendarTitle = t('tabs.calendar');

  // Lecture en échec : on ouvre l'app plutôt que de renvoyer à l'accueil (pas de piège).
  if (onboarding.data === undefined && !onboarding.error) return <LoadingScreen />;
  if (onboarding.data === false) return <Redirect href="/onboarding" />;

  return (
    <TabBarVisibility>
      <Tabs
        tabBar={(props) => <SlidingTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
          tabBarLabelStyle: {
            fontFamily: fonts.bodySemiBold,
            fontSize: textVariants.label.fontSize,
          },
          animation: reduced ? 'none' : 'fade',
          transitionSpec: reduced
            ? undefined
            : { animation: 'timing', config: { duration: 180, easing: Easing.out(Easing.cubic) } },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ title: t('tabs.today'), tabBarIcon: tabIcon('sun') }}
        />
        <Tabs.Screen
          name="calendar"
          options={{ title: calendarTitle, tabBarIcon: tabIcon('calendar') }}
        />
        <Tabs.Screen
          name="tasks"
          options={{ title: t('tabs.notebook'), tabBarIcon: tabIcon('clipboard') }}
        />
        {/* Ancienne adresse des notes : redirige vers le Carnet, sans bouton dans la barre. */}
        <Tabs.Screen name="notes" options={{ href: null }} />
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
    </TabBarVisibility>
  );
}
