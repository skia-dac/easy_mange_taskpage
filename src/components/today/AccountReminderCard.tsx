import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useAccountBackup } from '@/hooks/useAccountBackup';
import { userMessageKey } from '@/shared/errors';
import { useTheme } from '@/shared/theme';
import { AppText, Button, Card, IconBadge, RiseIn, showError, TextButton } from '@/shared/ui';

/**
 * Aujourd'hui, sans compte : « Crée un compte pour ne jamais perdre tes données ».
 * Visible seulement avec assez de données, jamais quand les comptes sont indisponibles ;
 * « Plus tard » la fait taire 14 jours (logique : `shouldShowAccountReminder`).
 */
export function AccountReminderCard() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { showReminder, snooze } = useAccountBackup();
  if (!showReminder) return null;

  return (
    <RiseIn>
      <Card>
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <IconBadge icon="cloud" />
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <AppText variant="bodyStrong">{t('accountBackup.reminderTitle')}</AppText>
              <AppText variant="caption" color="muted">
                {t('accountBackup.reminderHint')}
              </AppText>
            </View>
          </View>
          <Button
            label={t('accountBackup.createAccount')}
            onPress={() => router.push('/auth/sign-up')}
          />
          <TextButton
            label={t('accountBackup.later')}
            onPress={() => {
              snooze().catch((e: unknown) => showError(userMessageKey(e)));
            }}
          />
        </View>
      </Card>
    </RiseIn>
  );
}
