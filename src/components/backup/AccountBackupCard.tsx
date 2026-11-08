import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useAccountBackup } from '@/hooks/useAccountBackup';
import { useLabels } from '@/hooks/useLabels';
import { formatDateTime } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { AppText, Button, Card, IconBadge, showError, showToast, TextButton } from '@/shared/ui';

/**
 * Réglages › Mes données : où sont tes données ?
 * Avec un compte, elles sont sauvegardées sur le compte (synchronisation) ; sans compte, elles ne
 * sont que sur ce téléphone, et la carte le dit clairement, avec « Créer un compte ».
 */
export function AccountBackupCard() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { spacing } = useTheme();
  const backup = useAccountBackup();
  const [busy, setBusy] = useState(false);

  if (backup.mode === 'loading') return null;

  if (backup.mode === 'unavailable' || backup.mode === 'signedOut') {
    return (
      <Card>
        <View style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <IconBadge icon="smartphone" color="warning" background="warningSoft" />
            <AppText variant="bodyStrong" style={{ flex: 1 }}>
              {t('accountBackup.phoneOnlyTitle')}
            </AppText>
          </View>
          <AppText>{t('accountBackup.phoneOnlyMessage')}</AppText>
          {backup.mode === 'unavailable' ? (
            <AppText variant="caption" color="muted">
              {t('accountBackup.unavailable')}
            </AppText>
          ) : (
            <>
              <Button
                label={t('accountBackup.createAccount')}
                onPress={() => router.push('/auth/sign-up')}
              />
              <Button
                variant="secondary"
                label={t('auth.signIn')}
                onPress={() => router.push('/auth/sign-in')}
              />
            </>
          )}
        </View>
      </Card>
    );
  }

  if (backup.mode === 'otherAccount') {
    return (
      <Card>
        <View style={{ gap: spacing.md }}>
          <AppText variant="bodyStrong">{t('accountBackup.otherTitle')}</AppText>
          <AppText color="muted">{t('accountBackup.otherMessage')}</AppText>
          <TextButton
            label={t('accountBackup.openAccount')}
            onPress={() => router.push('/account')}
          />
        </View>
      </Card>
    );
  }

  const saving = busy || backup.syncing;
  const saveNow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await backup.saveNow();
      if (result.kind === 'saved') {
        showToast(
          {
            title: t('accountBackup.savedToast'),
            detail: formatDateTime(new Date(result.at), labels.lang),
          },
          { tone: 'success' },
        );
      } else if (result.kind === 'offline') {
        showToast(t('accountBackup.offline'));
      } else if (result.kind === 'otherAccount') {
        showError('accountBackup.otherMessage');
      } else {
        showError('accountBackup.error');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <IconBadge icon="cloud" color="success" background="successSoft" />
          <AppText variant="bodyStrong" style={{ flex: 1 }}>
            {t('accountBackup.savedTitle')}
          </AppText>
        </View>
        <View style={{ gap: spacing.xxs }}>
          <AppText variant="caption" color="muted">
            {saving
              ? t('accountBackup.saving')
              : backup.lastSyncAt
                ? t('accountBackup.last', {
                    date: formatDateTime(new Date(backup.lastSyncAt), labels.lang),
                  })
                : t('accountBackup.never')}
          </AppText>
          {backup.pending > 0 ? (
            <AppText variant="caption" color="warning">
              {t('sync.pending', { count: backup.pending })}
            </AppText>
          ) : null}
          <AppText variant="caption" color="muted">
            {t('accountBackup.filesHint')}
          </AppText>
        </View>
        <Button
          label={saving ? t('accountBackup.saving') : t('accountBackup.saveNow')}
          disabled={saving}
          accessibilityState={{ busy: saving }}
          onPress={() => void saveNow()}
        />
      </View>
    </Card>
  );
}
