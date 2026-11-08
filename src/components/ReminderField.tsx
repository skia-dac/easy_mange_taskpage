import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Linking, View } from 'react-native';

import {
  ensurePermission,
  notificationPermission,
  type NotificationPermission,
} from '@/modules/platform';
import { addDaysIso, atTime, toIsoDate, toTime, type IsoDate } from '@/shared/dates';
import { logger } from '@/shared/logger';
import { useTheme } from '@/shared/theme';
import { AppText, ChoiceChips, confirmAction, DateTimeField, TextButton } from '@/shared/ui';

type Preset = 'none' | 'dayBefore' | 'sameDay' | 'custom';

type Props = {
  /** Échéance ; null = sans date (seul un rappel « Personnalisé » a du sens). */
  dueDate: IsoDate | null;
  /** ISO date-heure du rappel, ou null. */
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
};

function presetValue(preset: Preset, dueDate: IsoDate | null): string | null {
  if (!dueDate) return null;
  if (preset === 'dayBefore') return atTime(addDaysIso(dueDate, -1), '18:00').toISOString();
  if (preset === 'sameDay') return atTime(dueDate, '09:00').toISOString();
  return null;
}

/**
 * Permission des notifications, demandée au moment où l'on choisit un rappel : d'abord une courte
 * explication (dans l'app), puis la demande du système. Refusée : le champ le dit, avec un bouton
 * vers les réglages du téléphone. `null` tant que l'état n'est pas connu (ou illisible).
 */
export function useReminderPermission(active: boolean) {
  const { t } = useTranslation();
  const [state, setState] = useState<NotificationPermission | null>(null);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const refresh = () =>
      notificationPermission().then(
        (p) => alive && setState(p),
        (e: unknown) => logger.error(e, { where: 'reminderPermission' }),
      );
    void refresh();
    // Retour des réglages du téléphone : l'état a peut-être changé.
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [active]);

  /** Demande la permission si elle n'est pas encore décidée (après l'explication). */
  const ask = useCallback(async () => {
    try {
      const current = await notificationPermission();
      if (current !== 'undetermined') {
        setState(current);
        return;
      }
      const ok = await confirmAction(
        t('reminder.permissionTitle'),
        t('reminder.permissionMessage'),
        t('reminder.permissionContinue'),
      );
      if (!ok) {
        setState('undetermined');
        return;
      }
      await ensurePermission();
      setState(await notificationPermission());
    } catch (e) {
      logger.error(e, { where: 'reminderPermission' });
    }
  }, [t]);

  return { state, ask };
}

/** Rappel d'un devoir ou d'une tâche (§73, §75) : préréglages simples ou date + heure au choix. */
export function ReminderField({ dueDate, value, onChange, error }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const permission = useReminderPermission(!!value);
  const detected = useMemo<Preset>(() => {
    if (!value) return 'none';
    if (value === presetValue('dayBefore', dueDate)) return 'dayBefore';
    if (value === presetValue('sameDay', dueDate)) return 'sameDay';
    return 'custom';
  }, [value, dueDate]);
  const [preset, setPreset] = useState<Preset>(detected);
  const current = preset === 'custom' && value ? new Date(value) : null;

  const choose = (p: Preset) => {
    setPreset(p);
    // Sans date : le rappel personnalisé propose demain à 09:00.
    const base = dueDate ?? addDaysIso(toIsoDate(new Date()), 1);
    if (p === 'custom') onChange(value ?? atTime(base, '09:00').toISOString());
    else onChange(presetValue(p, dueDate));
    // Premier rappel choisi : c'est le bon moment pour demander la permission.
    if (p !== 'none' && !value) void permission.ask();
  };

  const off = !!value && (permission.state === 'undetermined' || permission.state === 'denied');

  return (
    <View style={{ gap: spacing.md }}>
      <ChoiceChips
        label={t('reminder.label')}
        options={[
          { value: 'none' as Preset, label: t('reminder.none') },
          // « La veille » et « le jour même » n'existent qu'avec une date.
          ...(dueDate
            ? [
                { value: 'dayBefore' as Preset, label: t('reminder.dayBefore') },
                { value: 'sameDay' as Preset, label: t('reminder.sameDay') },
              ]
            : []),
          { value: 'custom' as Preset, label: t('reminder.custom') },
        ]}
        selected={[preset === detected || preset === 'custom' ? preset : detected]}
        onToggle={choose}
      />
      {preset === 'custom' && current ? (
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <DateTimeField
              label={t('reminder.customDate')}
              mode="date"
              required
              value={toIsoDate(current)}
              onChange={(d) => d && onChange(atTime(d, toTime(current)).toISOString())}
            />
          </View>
          <View style={{ flex: 1 }}>
            <DateTimeField
              label={t('reminder.customTime')}
              mode="time"
              required
              value={toTime(current)}
              onChange={(tm) => tm && onChange(atTime(toIsoDate(current), tm).toISOString())}
            />
          </View>
        </View>
      ) : null}
      {error ? (
        <AppText variant="caption" color="danger" accessibilityRole="alert">
          {error}
        </AppText>
      ) : null}
      {off ? (
        <View style={{ gap: spacing.xs }} testID="reminder-permission-off">
          <AppText variant="caption" color="warning">
            {t('reminder.permissionOff')}
          </AppText>
          {permission.state === 'denied' ? (
            <TextButton
              label={t('reminder.permissionSettings')}
              onPress={() => void Linking.openSettings().catch(() => undefined)}
            />
          ) : (
            <TextButton
              label={t('reminder.permissionAllow')}
              onPress={() => void permission.ask()}
            />
          )}
        </View>
      ) : null}
    </View>
  );
}
