import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  openNotificationSettings,
  useNotificationPermission,
} from '@/hooks/useNotificationPermission';
import { getNotificationPreferences, type NotificationPreferences } from '@/modules/identity';
import { addDaysIso, atTime, toIsoDate, toTime, type IsoDate } from '@/shared/dates';
import { settingTable, useLiveQuery } from '@/shared/db';
import { useTheme } from '@/shared/theme';
import { AppText, ChoiceChips, DateTimeField, TextButton } from '@/shared/ui';

type Preset = 'none' | 'dayBefore' | 'sameDay' | 'custom';

/** Ce que le rappel accompagne : chaque type a son interrupteur dans Réglages › Rappels. */
export type ReminderKind = 'task' | 'assignment' | 'event';

const SETTING: Record<ReminderKind, keyof NotificationPreferences> = {
  task: 'tasks',
  assignment: 'assignments',
  event: 'events',
};

type Props = {
  /** Échéance ; null = sans date (seul un rappel « Personnalisé » a du sens). */
  dueDate: IsoDate | null;
  /** ISO date-heure du rappel, ou null. */
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
  /** Type d'élément : une note s'affiche si ses rappels sont coupés dans Réglages. */
  kind?: ReminderKind;
};

export function presetValue(preset: Preset, dueDate: IsoDate | null): string | null {
  if (!dueDate) return null;
  if (preset === 'dayBefore') return atTime(addDaysIso(dueDate, -1), '18:00').toISOString();
  if (preset === 'sameDay') return atTime(dueDate, '09:00').toISOString();
  return null;
}

/** Un rappel dans le passé ne sonnerait jamais (le planificateur l'ignore). */
export function isPast(value: string | null, now: Date = new Date()): boolean {
  return !!value && new Date(value).getTime() <= now.getTime();
}

/**
 * Préréglages proposés : « La veille à 18:00 » et « Le jour même à 09:00 » seulement avec une
 * échéance, et seulement s'ils sont encore à venir (une tâche pour aujourd'hui n'a plus de
 * « veille » ; à 11:00, « le jour même à 09:00 » est passé).
 */
export function availablePresets(dueDate: IsoDate | null, now: Date = new Date()): Preset[] {
  const timed = (['dayBefore', 'sameDay'] as const).filter(
    (p) => !isPast(presetValue(p, dueDate), now) && presetValue(p, dueDate) !== null,
  );
  return ['none', ...timed, 'custom'];
}

/**
 * Premier rappel « Personnalisé » : le jour de l'échéance (ou demain sans date) à 09:00, ou, si
 * c'est déjà passé, la prochaine heure pile.
 */
export function defaultCustom(dueDate: IsoDate | null, now: Date = new Date()): string {
  const base = atTime(dueDate ?? addDaysIso(toIsoDate(now), 1), '09:00');
  if (base.getTime() > now.getTime()) return base.toISOString();
  const next = new Date(now);
  next.setHours(now.getHours() + 1, 0, 0, 0);
  return next.toISOString();
}

/** Rappel d'un devoir ou d'une tâche (§73, §75) : préréglages simples ou date + heure au choix. */
export function ReminderField({ dueDate, value, onChange, error, kind }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const permission = useNotificationPermission(!!value);
  const prefs = useLiveQuery(getNotificationPreferences, [settingTable('notifications')], []);
  const detected = useMemo<Preset>(() => {
    if (!value) return 'none';
    if (value === presetValue('dayBefore', dueDate)) return 'dayBefore';
    if (value === presetValue('sameDay', dueDate)) return 'sameDay';
    return 'custom';
  }, [value, dueDate]);
  // Une seule source : la valeur (et l'échéance). Seule exception, « Personnalisé » choisi alors
  // que l'heure correspond encore à un préréglage : les champs date / heure restent ouverts.
  // Une échéance retirée garde le rappel à son heure : il devient « Personnalisé », toujours
  // affiché et modifiable (jamais un rappel caché).
  const [customChosen, setCustomChosen] = useState(false);
  // Heure personnalisée refusée parce qu'elle est passée : le message reste jusqu'au prochain choix.
  const [rejected, setRejected] = useState(false);
  const shown: Preset = !value ? 'none' : customChosen ? 'custom' : detected;
  const current = shown === 'custom' && value ? new Date(value) : null;
  const available = availablePresets(dueDate);
  // Un préréglage déjà enregistré mais passé reste visible (sélectionné) : rien ne disparaît.
  const options = (['none', 'dayBefore', 'sameDay', 'custom'] as const).filter(
    (p) => available.includes(p) || p === shown,
  );

  const choose = (p: Preset) => {
    setCustomChosen(p === 'custom');
    setRejected(false);
    if (p === 'custom') onChange(value && !isPast(value) ? value : defaultCustom(dueDate));
    else onChange(presetValue(p, dueDate));
    // Premier rappel choisi : c'est le bon moment pour demander la permission.
    if (p !== 'none' && !value) void permission.ask();
  };

  /** Date ou heure personnalisée : un moment passé est refusé, avec un message clair. */
  const chooseCustom = (next: Date) => {
    if (isPast(next.toISOString())) {
      setRejected(true);
      return;
    }
    setRejected(false);
    onChange(next.toISOString());
  };

  const off = !!value && (permission.state === 'undetermined' || permission.state === 'denied');
  const settingOff = !!value && !!kind && prefs.data?.[SETTING[kind]] === false;
  const past = rejected || isPast(value);

  return (
    <View style={{ gap: spacing.md }}>
      <ChoiceChips
        label={t('reminder.label')}
        options={options.map((p) => ({ value: p, label: t(`reminder.${p}`) }))}
        selected={[shown]}
        onToggle={choose}
      />
      {current ? (
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <DateTimeField
              label={t('reminder.customDate')}
              mode="date"
              required
              value={toIsoDate(current)}
              onChange={(d) => d && chooseCustom(atTime(d, toTime(current)))}
            />
          </View>
          <View style={{ flex: 1 }}>
            <DateTimeField
              label={t('reminder.customTime')}
              mode="time"
              required
              value={toTime(current)}
              onChange={(tm) => tm && chooseCustom(atTime(toIsoDate(current), tm))}
            />
          </View>
        </View>
      ) : null}
      {past ? (
        <AppText variant="caption" color="danger" accessibilityRole="alert" testID="reminder-past">
          {t('reminder.pastError')}
        </AppText>
      ) : null}
      {error ? (
        <AppText variant="caption" color="danger" accessibilityRole="alert">
          {t(error)}
        </AppText>
      ) : null}
      {settingOff && kind ? (
        <View style={{ gap: spacing.xs }} testID="reminder-setting-off">
          <AppText variant="caption" color="warning">
            {t(`reminder.settingOff.${kind}`)}
          </AppText>
          <TextButton
            label={t('reminder.openAppSettings')}
            onPress={() => router.push('/settings')}
          />
        </View>
      ) : null}
      {off ? (
        <View style={{ gap: spacing.xs }} testID="reminder-permission-off">
          <AppText variant="caption" color="warning">
            {t('reminder.permissionOff')}
          </AppText>
          {permission.state === 'denied' ? (
            <TextButton
              label={t('reminder.permissionSettings')}
              onPress={openNotificationSettings}
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
