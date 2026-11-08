import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { addDaysIso, type IsoDate } from '@/shared/dates';
import { formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { fieldLimits, TextField, useDateTimePicker } from '@/shared/ui';

import { SelectChip } from './SelectChip';

type Props = {
  today: IsoDate;
  date: IsoDate;
  onDate: (date: IsoDate) => void;
  note: string;
  onNote: (note: string) => void;
  noteError?: string;
};

/**
 * Détails facultatifs d'une opération, repliés : une ligne de pastilles pour la date
 * (« Aujourd'hui », par défaut, « Hier », « Choisir… », qui affiche ensuite la date choisie), et
 * « Ajouter une note », qui ouvre le champ. Une note déjà écrite (modification) ou refusée reste
 * ouverte.
 */
export function EntryDetails({ today, date, onDate, note, onNote, noteError }: Props) {
  const { t, i18n } = useTranslation();
  const { colors, spacing } = useTheme();
  const picker = useDateTimePicker('date', t('money.date'));
  const [noteOpen, setNoteOpen] = useState(false);
  const yesterday = addDaysIso(today, -1);
  const other = date !== today && date !== yesterday;
  const showNote = noteOpen || note !== '' || !!noteError;

  return (
    <View style={{ gap: spacing.md }}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('money.date')}
        style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}
      >
        <Feather name="calendar" size={18} color={colors.muted} />
        <SelectChip
          testID="date-today"
          label={t('money.dateToday')}
          selected={date === today}
          onPress={() => onDate(today)}
        />
        <SelectChip
          testID="date-yesterday"
          label={t('money.dateYesterday')}
          selected={date === yesterday}
          onPress={() => onDate(yesterday)}
        />
        <SelectChip
          testID="date-pick"
          label={other ? formatShortDate(date, i18n.language) : t('money.datePick')}
          accessibilityLabel={
            other
              ? t('money.datePicked', { date: formatShortDate(date, i18n.language) })
              : t('money.datePick')
          }
          selected={other}
          // Déjà choisie : un nouvel appui rouvre le calendrier pour changer de jour.
          reselectable
          onPress={() => picker.open(date, onDate)}
        />
      </View>
      {picker.element}
      {showNote ? (
        <TextField
          label={t('money.note')}
          value={note}
          onChangeText={onNote}
          error={noteError}
          placeholder={t('common.optional')}
          limit={fieldLimits.note120}
          autoFocus={noteOpen && note === ''}
        />
      ) : (
        <SelectChip
          role="button"
          testID="note-open"
          label={t('money.addNote')}
          leading={
            <Feather
              name="edit-3"
              size={16}
              color={colors.primary}
              style={{ marginLeft: spacing.sm }}
            />
          }
          onPress={() => setNoteOpen(true)}
        />
      )}
    </View>
  );
}
