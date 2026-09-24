import '@/shared/i18n';

import { BricolageGrotesque_700Bold } from '@expo-google-fonts/bricolage-grotesque/700Bold';
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AccountGate } from '@/components/AccountGate';
import { AppearanceProvider, AuthProvider, LanguageGate } from '@/modules/identity';
import { BackupGate, LockGate, NotificationsGate, WidgetsGate } from '@/modules/platform';
import { DATABASE_NAME, setupDatabase } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { logger } from '@/shared/logger';
import { fonts, useTheme } from '@/shared/theme';
import { AppText, Button, LoadingScreen } from '@/shared/ui';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { t } = useTranslation();
  const [fontsLoaded, fontError] = useFonts({
    BricolageGrotesque_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (fontError) logger.warn('Polices non chargées, police du système utilisée');
    if (ready) void SplashScreen.hideAsync();
  }, [ready, fontError]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Suspense fallback={<LoadingScreen message={t('loading.database')} />}>
          <SQLiteProvider databaseName={DATABASE_NAME} onInit={setupDatabase} useSuspense>
            <AuthProvider>
              <LanguageGate />
              <NotificationsGate />
              <AccountGate />
              <BackupGate />
              <WidgetsGate />
              <AppearanceProvider>
                <ThemedStack />
                <LockGate />
              </AppearanceProvider>
            </AuthProvider>
          </SQLiteProvider>
        </Suspense>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Filet de sécurité : si un écran plante, l'utilisateur voit un message clair et peut réessayer. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();

  useEffect(() => {
    logger.error(error, { where: 'RootErrorBoundary' });
  }, [error]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.background,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xxl,
        gap: spacing.lg,
      }}
    >
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {t(userMessageKey(error))}
      </AppText>
      <Button label={t('errors.retry')} onPress={retry} />
    </View>
  );
}

/** Pile de navigation aux couleurs du thème (clair / sombre selon les réglages). */
function ThemedStack() {
  const { t } = useTranslation();
  const { colors, scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerBackTitle: t('common.back'),
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.text, fontFamily: fonts.bodyBold },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="add" options={{ presentation: 'modal', title: t('add.title') }} />
        <Stack.Screen name="settings" options={{ title: t('settings.title') }} />
        <Stack.Screen name="search" options={{ title: t('search.title') }} />
        <Stack.Screen name="notifications" options={{ title: t('notifications.title') }} />
        <Stack.Screen name="grades" options={{ title: t('grades.title') }} />
        <Stack.Screen name="study" options={{ title: t('study.title') }} />
        <Stack.Screen name="stats" options={{ title: t('stats.title') }} />
        <Stack.Screen name="privacy" options={{ title: t('privacy.title') }} />
        <Stack.Screen name="account/index" options={{ title: t('account.title') }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      </Stack>
    </>
  );
}
