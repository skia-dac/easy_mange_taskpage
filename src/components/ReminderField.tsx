import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { addDaysIso, atTime, toIsoDate, toTime, type IsoDate } from '@/shared/dates';
import { useTheme } from '@/shared/theme';
import { ChoiceChips, DateTimeField } from '@/shared/ui';

type Preset = 'none' | 'dayBefore' | 'sameDay' | 'custom';

type Props = {
  dueDate: IsoDate;
  /** ISO date-heure du rappel, ou null. */
  value: string | null;
  onChange: (value: string | null) => void;
  error?: string;
};

function presetValue(preset: Preset, dueDate: IsoDate): string | null {
  if (preset === 'dayBefore') return atTime(addDaysIso(dueDate, -1), '18:00').toISOString();
  if (preset === 'sameDay') return atTime(dueDate, '09:00').toISOString();
  return null;
}

/** Rappel d'un devoir ou d'une tâche (§73, §75) : préréglages simples ou date + heure au choix. */
export function ReminderField({ dueDate, value, onChange, error }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
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
    if (p === 'custom') onChange(value ?? atTime(dueDate, '09:00').toISOString());
    else onChange(presetValue(p, dueDate));
  };

  return (
    <View style={{ gap: spacing.md }}>
      <ChoiceChips
        label={t('reminder.label')}
        options={[
          { value: 'none', label: t('reminder.none') },
          { value: 'dayBefore', label: t('reminder.dayBefore') },
          { value: 'sameDay', label: t('reminder.sameDay') },
          { value: 'custom', label: t('reminder.custom') },
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
              error={error}
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
    </View>
  );
}
