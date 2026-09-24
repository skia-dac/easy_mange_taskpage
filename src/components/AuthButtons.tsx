import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { accountMessageKey, signInWithProvider, type OAuthProvider } from '@/modules/identity';
import { userMessageKey } from '@/shared/errors';
import { useTheme } from '@/shared/theme';
import { AppText, Button, showError } from '@/shared/ui';

/** « Continuer avec Google / Apple » (Apple obligatoire sur iPhone dès qu'on propose Google). */
export function AuthButtons({ onSignedIn }: { onSignedIn: () => Promise<void> }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const [busy, setBusy] = useState<OAuthProvider | null>(null);

  const go = async (provider: OAuthProvider) => {
    if (busy) return;
    setBusy(provider);
    try {
      if (await signInWithProvider(provider)) await onSignedIn();
    } catch (e) {
      showError(accountMessageKey(e, userMessageKey));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
        {t('auth.or')}
      </AppText>
      <Button
        variant="secondary"
        label={t('auth.withApple')}
        onPress={() => void go('apple')}
        disabled={busy !== null}
      />
      <Button
        variant="secondary"
        label={t('auth.withGoogle')}
        onPress={() => void go('google')}
        disabled={busy !== null}
      />
    </View>
  );
}
