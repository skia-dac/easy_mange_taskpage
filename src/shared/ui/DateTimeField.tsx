import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { atTime, fromIsoDate, toIsoDate, toTime, type IsoDate, type Time } from '../dates';
import { formatShortDate } from '../format';
import { minTouchSize, spacing as space, useTheme } from '../theme';
import { AppText } from './AppText';
import { BottomSheet } from './BottomSheet';
import { FieldShell } from './FieldShell';
import { Tappable } from './Tappable';

type Mode = 'date' | 'time';

type Props = {
  label: string;
  mode: Mode;
  /** « AAAA-MM-JJ » pour une date, « HH:MM » pour une heure ; null = vide (champ facultatif). */
  value: string | null;
  onChange: (value: string | null) => void;
  required?: boolean;
  error?: string;
  /** Autorise à vider le champ (heure facultative). */
  clearable?: boolean;
};

function toDate(mode: Mode, value: string | null): Date {
  const today: IsoDate = toIsoDate(new Date());
  if (mode === 'date') return fromIsoDate(value ?? today);
  return atTime(today, (value as Time | null) ?? '08:00');
}

const toValue = (mode: Mode, d: Date) => (mode === 'date' ? toIsoDate(d) : toTime(d));

type Request = { draft: Date; onPick: (value: string) => void; minimumDate?: Date };

/**
 * Le sélecteur natif seul, sans champ autour : fenêtre du bas sur iPhone, boîte de dialogue sur
 * Android. `open(valeur, onPick)` l'ouvre ; `element` est à poser dans l'écran (rien sur Android).
 * Utilisé par `DateTimeField`, et directement là où une date se choisit sans formulaire
 * (« Reporter › Choisir une autre date… »).
 */
export function useDateTimePicker(
  mode: Mode,
  label: string,
): {
  open: (value: string | null, onPick: (value: string) => void, minimumDate?: IsoDate) => void;
  element: ReactNode;
} {
  const { t, i18n } = useTranslation();
  const { colors, spacing, scheme } = useTheme();
  const [visible, setVisible] = useState(false);
  // Gardée pendant la fermeture : la fenêtre ne se vide pas en disparaissant.
  const [request, setRequest] = useState<Request | null>(null);

  const open = (value: string | null, onPick: (value: string) => void, minimumDate?: IsoDate) => {
    const min = minimumDate ? fromIsoDate(minimumDate) : undefined;
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(mode, value),
        mode,
        is24Hour: true,
        minimumDate: min,
        onChange: (e, d) => e.type === 'set' && d && onPick(toValue(mode, d)),
      });
      return;
    }
    setRequest({ draft: toDate(mode, value), onPick, minimumDate: min });
    setVisible(true);
  };

  const element =
    Platform.OS === 'ios' ? (
      <BottomSheet
        visible={visible && request !== null}
        onClose={() => setVisible(false)}
        style={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Tappable accessibilityRole="button" onPress={() => setVisible(false)} style={textTarget}>
            <AppText variant="bodyStrong" color="muted">
              {t('common.cancel')}
            </AppText>
          </Tappable>
          <AppText variant="bodyStrong" accessibilityRole="header" style={{ flexShrink: 1 }}>
            {label}
          </AppText>
          <Tappable
            accessibilityRole="button"
            onPress={() => {
              if (request) request.onPick(toValue(mode, request.draft));
              setVisible(false);
            }}
            style={textTarget}
          >
            <AppText variant="bodyStrong" color="primary">
              {t('common.ok')}
            </AppText>
          </Tappable>
        </View>
        {request ? (
          <DateTimePicker
            testID="date-time-picker"
            value={request.draft}
            mode={mode}
            display={mode === 'date' ? 'inline' : 'spinner'}
            locale={i18n.language}
            themeVariant={scheme}
            accentColor={colors.primary}
            minuteInterval={5}
            minimumDate={request.minimumDate}
            onChange={(_e, d) => d && setRequest({ ...request, draft: d })}
          />
        ) : null}
      </BottomSheet>
    ) : null;

  return { open, element };
}

// Bouton texte (« Effacer », « Annuler », « OK ») : zone touchable de 44 pt, pas un simple hitSlop.
const textTarget = {
  minHeight: minTouchSize,
  minWidth: minTouchSize,
  paddingHorizontal: space.sm,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

/**
 * Choix d'une date ou d'une heure. Même champ sur iPhone et Android : on touche, le sélecteur
 * natif s'ouvre (fenêtre sur iPhone, boîte de dialogue sur Android), la valeur s'affiche pareil.
 */
export function DateTimeField({ label, mode, value, onChange, required, error, clearable }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const picker = useDateTimePicker(mode, label);

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
          onPress={() => picker.open(value, onChange)}
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
      {picker.element}
    </FieldShell>
  );
}
