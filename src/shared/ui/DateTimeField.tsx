import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { atTime, fromIsoDate, toIsoDate, toTime, type IsoDate, type Time } from '../dates';
import { formatShortDate } from '../format';
import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';
import { FieldShell } from './FieldShell';

type Props = {
  label: string;
  mode: 'date' | 'time';
  /** « AAAA-MM-JJ » pour une date, « HH:MM » pour une heure ; null = vide (champ facultatif). */
  value: string | null;
  onChange: (value: string | null) => void;
  required?: boolean;
  error?: string;
  /** Autorise à vider le champ (heure facultative). */
  clearable?: boolean;
};

function toDate(mode: Props['mode'], value: string | null): Date {
  const today: IsoDate = toIsoDate(new Date());
  if (mode === 'date') return fromIsoDate(value ?? today);
  return atTime(today, (value as Time | null) ?? '08:00');
}

/** Choix d'une date ou d'une heure avec le sélecteur natif (compact sur iPhone). */
export function DateTimeField({ label, mode, value, onChange, required, error, clearable }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, radius, spacing, scheme } = useTheme();
  const toValue = (d: Date) => (mode === 'date' ? toIsoDate(d) : toTime(d));

  const clear =
    clearable && value ? (
      <Pressable accessibilityRole="button" onPress={() => onChange(null)} hitSlop={12}>
        <AppText variant="bodyStrong" color="primary">
          {t('common.clear')}
        </AppText>
      </Pressable>
    ) : null;

  if (Platform.OS === 'ios') {
    return (
      <FieldShell label={label} required={required} error={error}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            minHeight: minTouchSize,
          }}
        >
          {value === null ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onChange(toValue(toDate(mode, null)))}
              style={{ minHeight: minTouchSize, justifyContent: 'center' }}
            >
              <AppText variant="bodyStrong" color="primary">
                {t('common.add')}
              </AppText>
            </Pressable>
          ) : (
            <DateTimePicker
              value={toDate(mode, value)}
              mode={mode}
              display="compact"
              locale={i18n.language}
              themeVariant={scheme}
              accentColor={colors.primary}
              minuteInterval={5}
              onChange={(_e, d) => d && onChange(toValue(d))}
            />
          )}
          {clear}
        </View>
      </FieldShell>
    );
  }

  const open = () =>
    DateTimePickerAndroid.open({
      value: toDate(mode, value),
      mode,
      is24Hour: true,
      onChange: (e, d) => e.type === 'set' && d && onChange(toValue(d)),
    });

  return (
    <FieldShell label={label} required={required} error={error}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={open}
          style={{
            flex: 1,
            minHeight: minTouchSize + 6,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md + 2,
            justifyContent: 'center',
          }}
        >
          <AppText color={value ? 'text' : 'muted'}>
            {value
              ? mode === 'date'
                ? formatShortDate(value, i18n.language)
                : value
              : t('common.choose')}
          </AppText>
        </Pressable>
        {clear}
      </View>
    </FieldShell>
  );
}
