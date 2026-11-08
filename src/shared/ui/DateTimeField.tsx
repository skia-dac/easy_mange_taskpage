import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { atTime, fromIsoDate, toIsoDate, toTime, type IsoDate, type Time } from '../dates';
import { formatShortDate } from '../format';
import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { FieldShell } from './FieldShell';
import { Tappable } from './Tappable';

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

/**
 * Choix d'une date ou d'une heure. Même champ sur iPhone et Android : on touche, le sélecteur
 * natif s'ouvre (fenêtre sur iPhone, boîte de dialogue sur Android), la valeur s'affiche pareil.
 */
export function DateTimeField({ label, mode, value, onChange, required, error, clearable }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, radius, spacing, scheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Date>(() => toDate(mode, value));
  const toValue = (d: Date) => (mode === 'date' ? toIsoDate(d) : toTime(d));

  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(mode, value),
        mode,
        is24Hour: true,
        onChange: (e, d) => e.type === 'set' && d && onChange(toValue(d)),
      });
      return;
    }
    setDraft(toDate(mode, value));
    setOpen(true);
  };

  // Bouton texte (« Effacer », « Annuler », « OK ») : zone touchable de 44 pt, pas un simple hitSlop.
  const textTarget = {
    minHeight: minTouchSize,
    minWidth: minTouchSize,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  } as const;

  const display = value
    ? mode === 'date'
      ? formatShortDate(value, i18n.language)
      : value
    : t('common.choose');

  return (
    <FieldShell label={label} required={required} error={error}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Tappable
          accessibilityRole="button"
          accessibilityLabel={`${label} : ${display}`}
          onPress={openPicker}
          style={{
            flex: 1,
            minHeight: minTouchSize + 6,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: error ? colors.danger : colors.outline,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            justifyContent: 'center',
          }}
        >
          <AppText color={value ? 'text' : 'muted'}>{display}</AppText>
        </Tappable>
        {clearable && value ? (
          <Tappable
            accessibilityRole="button"
            accessibilityLabel={t('common.clearField', { label })}
            onPress={() => onChange(null)}
            style={textTarget}
          >
            <AppText variant="bodyStrong" color="primary">
              {t('common.clear')}
            </AppText>
          </Tappable>
        ) : null}
      </View>

      {Platform.OS === 'ios' ? (
        <BottomSheet
          visible={open}
          onClose={() => setOpen(false)}
          style={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        >
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Tappable accessibilityRole="button" onPress={() => setOpen(false)} style={textTarget}>
              <AppText variant="bodyStrong" color="muted">
                {t('common.cancel')}
              </AppText>
            </Tappable>
            <AppText variant="bodyStrong" accessibilityRole="header">
              {label}
            </AppText>
            <Tappable
              accessibilityRole="button"
              onPress={() => {
                onChange(toValue(draft));
                setOpen(false);
              }}
              style={textTarget}
            >
              <AppText variant="bodyStrong" color="primary">
                {t('common.ok')}
              </AppText>
            </Tappable>
          </View>
          <DateTimePicker
            value={draft}
            mode={mode}
            display={mode === 'date' ? 'inline' : 'spinner'}
            locale={i18n.language}
            themeVariant={scheme}
            accentColor={colors.primary}
            minuteInterval={5}
            onChange={(_e, d) => d && setDraft(d)}
          />
        </BottomSheet>
      ) : null}
    </FieldShell>
  );
}
