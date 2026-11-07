import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { canRestore, ignoreConflict, listConflicts, restoreConflict } from '@/modules/platform';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatDateTime } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Card,
  confirmAction,
  EmptyState,
  LoadingScreen,
  showError,
  TextButton,
} from '@/shared/ui';

/**
 * Conflits de synchronisation : versions locales remplacées par celle d'un autre appareil, ou
 * modifications refusées par le serveur. Restaurer renvoie la version locale ; ignorer la classe.
 */
export default function ConflictsScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { spacing } = useTheme();
  const conflicts = useLiveQuery(listConflicts, ['sync_conflicts'], []);

  if (conflicts.loading) return <LoadingScreen />;
  const list = conflicts.data ?? [];

  const run = async (job: () => Promise<void>) => {
    try {
      await job();
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('conflicts.title') }} />
      <AppText color="muted">{t('conflicts.intro')}</AppText>
      {list.length === 0 ? (
        <EmptyState icon="check-circle" title={t('conflicts.empty')} />
      ) : (
        list.map((c) => (
          <Card key={c.id}>
            <View style={{ gap: spacing.sm }}>
              <AppText variant="bodyStrong" numberOfLines={2}>
                {c.title ?? t(`conflicts.entities.${c.entity}`, { defaultValue: c.entity })}
              </AppText>
              <AppText variant="caption" color="muted">
                {t(`conflicts.entities.${c.entity}`, { defaultValue: c.entity })} ·{' '}
                {formatDateTime(new Date(c.createdAt), labels.lang)}
              </AppText>
              <AppText variant="caption" color="muted">
                {c.rejection ? t('conflicts.rejected') : t('conflicts.replaced')}
              </AppText>
              {c.rejection ? (
                <>
                  {/* Motif lisible, jamais le message technique du serveur. */}
                  <AppText variant="caption">{t(`conflicts.rejection.${c.rejection}`)}</AppText>
                  <AppText variant="caption" color="muted">
                    {t('conflicts.rejectedHint')}
                  </AppText>
                </>
              ) : null}
              <View style={{ flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' }}>
                {/* Une modification refusée ne se renvoie pas à l'identique : seulement « Ignorer ». */}
                {canRestore(c) ? (
                  <TextButton
                    label={t('conflicts.restore')}
                    onPress={() =>
                      void run(async () => {
                        const ok = await confirmAction(
                          t('conflicts.restoreTitle'),
                          t('conflicts.restoreMessage'),
                          t('conflicts.restore'),
                        );
                        if (ok) await restoreConflict(db, c.id);
                      })
                    }
                  />
                ) : null}
                <TextButton
                  label={t('conflicts.ignore')}
                  color="muted"
                  onPress={() => void run(() => ignoreConflict(db, c.id))}
                />
              </View>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}
