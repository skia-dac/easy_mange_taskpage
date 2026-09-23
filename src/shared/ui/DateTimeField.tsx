import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
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

  const display = value
    ? mode === 'date'
      ? formatShortDate(value, i18n.language)
      : value
    : t('common.choose');

  return (
    <FieldShell label={label} required={required} error={error}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} : ${display}`}
          onPress={openPicker}
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
          <AppText color={value ? 'text' : 'muted'}>{display}</AppText>
        </Pressable>
        {clearable && value ? (
          <Pressable accessibilityRole="button" onPress={() => onChange(null)} hitSlop={12}>
            <AppText variant="bodyStrong" color="primary">
              {t('common.clear')}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {Platform.OS === 'ios' ? (
        <Modal
          visible={open}
          transparent
          animationType="fade"
          onRequestClose={() => setOpen(false)}
        >
          <Pressable
            onPress={() => setOpen(false)}
            style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.surface,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                padding: spacing.lg,
                paddingBottom: spacing.xxl,
                gap: spacing.sm,
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Pressable accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={10}>
                  <AppText variant="bodyStrong" color="muted">
                    {t('common.cancel')}
                  </AppText>
                </Pressable>
                <AppText variant="bodyStrong">{label}</AppText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onChange(toValue(draft));
                    setOpen(false);
                  }}
                  hitSlop={10}
                >
                  <AppText variant="bodyStrong" color="primary">
                    {t('common.ok')}
                  </AppText>
                </Pressable>
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
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </FieldShell>
  );
}
