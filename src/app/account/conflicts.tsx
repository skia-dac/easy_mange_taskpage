import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { formatMoney } from '@/modules/finance';
import {
  canRestore,
  conflictFields,
  ignoreConflict,
  listConflicts,
  restoreConflict,
  type ConflictField,
  type SyncConflict,
} from '@/modules/platform';
import { isIsoDate } from '@/shared/dates';
import { useDb, useLiveQuery, type SqlValue } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatDateTime, formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Card,
  confirmAction,
  confirmDestructive,
  EmptyState,
  loadStateOf,
  LoadingScreen,
  showError,
  StateView,
  TextButton,
} from '@/shared/ui';

/**
 * Conflits de synchronisation : versions locales remplacées par celle d'un autre appareil, ou
 * modifications refusées par le serveur. Les champs clés des deux versions sont montrés côte à
 * côte ; restaurer renvoie la version locale ; abandonner la sienne demande confirmation.
 */
export default function ConflictsScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { spacing } = useTheme();
  const conflicts = useLiveQuery(listConflicts, ['sync_conflicts'], []);
  const state = loadStateOf(conflicts);

  if (state === 'loading') return <LoadingScreen />;

  const run = async (job: () => Promise<void>) => {
    try {
      await job();
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  /** Valeur lisible d'un champ (date, heure, montant, texte, supprimé). */
  const display = (f: ConflictField, value: SqlValue, currency: string | null): string => {
    if (f.type === 'deleted')
      return value ? t('conflicts.deletedValue') : t('conflicts.notDeletedValue');
    if (value === null) return t('conflicts.emptyValue');
    if (f.type === 'date' && typeof value === 'string' && isIsoDate(value))
      return formatShortDate(value, labels.lang);
    if (f.type === 'money' && typeof value === 'number' && currency)
      return formatMoney(value, currency);
    if (f.column === 'status' && typeof value === 'string')
      return t(`status.${value}`, { defaultValue: value });
    return String(value);
  };

  const ignore = (c: SyncConflict) =>
    run(async () => {
      const ok = await confirmDestructive(
        t('conflicts.ignoreTitle'),
        c.rejection ? t('conflicts.ignoreRejectedMessage') : t('conflicts.ignoreMessage'),
        t('conflicts.ignoreConfirm'),
      );
      if (ok) await ignoreConflict(db, c.id);
    });

  const list = conflicts.data ?? [];

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('conflicts.title') }} />
      <AppText color="muted">{t('conflicts.intro')}</AppText>
      {state === 'error' ? (
        <StateView state="error" onRetry={conflicts.retry} />
      ) : list.length === 0 ? (
        <EmptyState icon="check-circle" title={t('conflicts.empty')} />
      ) : (
        list.map((c) => {
          const fields = conflictFields(c);
          return (
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
                {fields.length > 0 ? (
                  <View style={{ gap: spacing.sm }} testID={`conflict-fields-${c.id}`}>
                    {fields.map((f) => (
                      <View
                        key={f.column}
                        accessible
                        accessibilityLabel={[
                          t(`conflicts.field.${f.column}`, { defaultValue: f.column }),
                          t('conflicts.line', {
                            label: t('conflicts.mine'),
                            value: display(f, f.local, f.localCurrency),
                          }),
                          c.server
                            ? t('conflicts.line', {
                                label: t('conflicts.theirs'),
                                value: display(f, f.server, f.serverCurrency),
                              })
                            : null,
                          f.differs ? t('conflicts.differs') : null,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                        style={{ gap: spacing.xxs }}
                      >
                        <AppText variant="caption" color={f.differs ? 'warning' : 'muted'}>
                          {t(`conflicts.field.${f.column}`, { defaultValue: f.column })}
                          {f.differs ? ` · ${t('conflicts.differs')}` : ''}
                        </AppText>
                        <AppText variant="caption">
                          {t('conflicts.line', {
                            label: t('conflicts.mine'),
                            value: display(f, f.local, f.localCurrency),
                          })}
                        </AppText>
                        {c.server ? (
                          <AppText variant="caption" color="muted">
                            {t('conflicts.line', {
                              label: t('conflicts.theirs'),
                              value: display(f, f.server, f.serverCurrency),
                            })}
                          </AppText>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}
                <View style={{ flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' }}>
                  {/* Une modification refusée ne se renvoie pas à l'identique : seulement abandonner. */}
                  {canRestore(c) ? (
                    <TextButton
                      label={t('conflicts.restore')}
                      onPress={() =>
                        void run(async () => {
                          const ok = await confirmAction(
                            t('conflicts.restoreTitle'),
                            t('conflicts.restoreMessage'),
                            t('conflicts.restoreConfirm'),
                          );
                          if (ok) await restoreConflict(db, c.id);
                        })
                      }
                    />
                  ) : null}
                  <TextButton
                    label={t('conflicts.ignore')}
                    color="muted"
                    onPress={() => void ignore(c)}
                  />
                </View>
              </View>
            </Card>
          );
        })
      )}
    </ScrollView>
  );
}
