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
  type ConflictKind,
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
 * Conflits de synchronisation : version du téléphone remplacée par celle d'un autre appareil (ou
 * l'inverse), modification refusée par le serveur, ou modification reçue impossible à enregistrer.
 * Les champs clés des deux versions sont montrés côte à côte ; restaurer reprend la version qui a
 * perdu ; abandonner une version demande confirmation.
 */
/** Ce qui s'est passé, selon la nature du conflit. */
const SUMMARY: Record<ConflictKind, string> = {
  server_won: 'conflicts.replaced',
  local_won: 'conflicts.keptMine',
  rejected: 'conflicts.rejected',
  incoming_rejected: 'conflicts.incomingRejected',
};

/** Libellé de la version de l'autre appareil. */
const THEIRS: Record<ConflictKind, string> = {
  server_won: 'conflicts.theirs',
  local_won: 'conflicts.theirsReplaced',
  rejected: 'conflicts.theirs',
  incoming_rejected: 'conflicts.theirsIncoming',
};

/** « Abandonner » : quelle version est perdue. */
const IGNORE_TITLE: Record<ConflictKind, string> = {
  server_won: 'conflicts.ignoreTitle',
  local_won: 'conflicts.ignoreTheirsTitle',
  rejected: 'conflicts.ignoreTitle',
  incoming_rejected: 'conflicts.ignoreTheirsTitle',
};

const IGNORE_MESSAGE: Record<ConflictKind, string> = {
  server_won: 'conflicts.ignoreMessage',
  local_won: 'conflicts.ignoreTheirsMessage',
  rejected: 'conflicts.ignoreRejectedMessage',
  incoming_rejected: 'conflicts.ignoreIncomingMessage',
};

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
        t(IGNORE_TITLE[c.kind]),
        t(IGNORE_MESSAGE[c.kind]),
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
          // Ta version a gagné : restaurer, c'est reprendre celle de l'autre appareil.
          const theirsWon = c.kind === 'local_won';
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
                  {t(SUMMARY[c.kind])}
                </AppText>
                {c.kind === 'incoming_rejected' ? (
                  <AppText variant="caption" color="muted">
                    {t('conflicts.incomingHint')}
                  </AppText>
                ) : null}
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
                                label: t(THEIRS[c.kind]),
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
                              label: t(THEIRS[c.kind]),
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
                      label={t(theirsWon ? 'conflicts.takeTheirs' : 'conflicts.restore')}
                      onPress={() =>
                        void run(async () => {
                          const ok = await confirmAction(
                            t(theirsWon ? 'conflicts.takeTheirsTitle' : 'conflicts.restoreTitle'),
                            t(
                              theirsWon
                                ? 'conflicts.takeTheirsMessage'
                                : 'conflicts.restoreMessage',
                            ),
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
