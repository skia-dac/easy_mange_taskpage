import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useAfterSignIn } from '@/hooks/useAfterSignIn';
import { accountMessageKey, completeFromUrl, redirectUrl } from '@/modules/identity';
import { userMessageKey } from '@/shared/errors';
import { useTheme } from '@/shared/theme';
import { Button, EmptyState, LoadingScreen } from '@/shared/ui';

/** Retour dans l'app après le lien de confirmation reçu par e-mail ou une connexion Google / Apple. */
export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const params = useLocalSearchParams<{ code?: string; error_code?: string }>();
  const after = useAfterSignIn();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const query = new URLSearchParams();
    if (params.code) query.set('code', params.code);
    if (params.error_code) query.set('error_code', params.error_code);
    completeFromUrl(`${redirectUrl('auth/callback')}?${query.toString()}`)
      .then(after)
      .catch((e: unknown) => setError(accountMessageKey(e, userMessageKey)));
    // Une seule fois, à l'arrivée sur l'écran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!error) return <LoadingScreen message={t('auth.finishing')} />;
  return (
    <View style={{ flex: 1, padding: spacing.xl, gap: spacing.lg, justifyContent: 'center' }}>
      <EmptyState icon="alert-circle" title={t(error)} />
      <Button label={t('auth.signIn')} onPress={() => router.replace('/auth/sign-in')} />
    </View>
  );
}
