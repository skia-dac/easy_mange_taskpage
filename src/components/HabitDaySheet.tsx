import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  missReasons,
  sessionDurationPresets,
  setHabitDone,
  setHabitDuration,
  setHabitMissed,
  type Habit,
  type HabitLog,
  type MissReason,
} from '@/modules/productivity';
import type { IsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatDuration, formatShortDate } from '@/shared/format';
import { minTouchSize, useTheme } from '@/shared/theme';
import {
  AppText,
  BottomSheet,
  Button,
  ChoiceChips,
  confirmDestructive,
  showError,
  TextButton,
  TextField,
  fieldLimits,
  Tappable,
} from '@/shared/ui';

type Props = {
  /** Fenêtre ouverte. Fermée, elle garde la dernière habitude affichée pendant qu'elle disparaît. */
  visible: boolean;
  habit: Habit | null;
  date: IsoDate | null;
  log: HabitLog | undefined;
  onClose: () => void;
  /** La fenêtre a fini de disparaître (voir `BottomSheet`). */
  onDismissed?: () => void;
};

type Choice = 'done' | 'missed' | 'excused';
type Shown = { habit: Habit; date: IsoDate; log: HabitLog | undefined };

/**
 * Noter un jour : fait, pas fait ou excusé. La raison est facultative
 * (quelques raisons rapides + un texte libre).
 *
 * Toujours montée et pilotée par `visible` : à la fermeture, elle garde l'habitude et le jour
 * affichés le temps de son animation de sortie. Chaque ouverture repart des valeurs enregistrées.
 */
export function HabitDaySheet({ visible, habit, date, log, onClose, onDismissed }: Props) {
  const { spacing } = useTheme();
  const open = visible && !!habit && !!date;
  const [shown, setShown] = useState<Shown | null>(open ? { habit, date, log } : null);
  // Chaque nouvelle ouverture remet le formulaire à zéro (clé de `DayForm`).
  const [session, setSession] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSession((n) => n + 1);
  }
  // Ouverte : on suit l'habitude, le jour et la ligne enregistrée. Fermée : on garde les derniers.
  if (open && (shown?.habit !== habit || shown.date !== date || shown.log !== log)) {
    setShown({ habit, date, log });
  }

  return (
    <BottomSheet
      visible={open && !!shown}
      onClose={onClose}
      onDismissed={onDismissed}
      avoidKeyboard
      style={{ gap: spacing.md }}
    >
      {shown ? (
        <DayForm
          key={`${session}:${shown.habit.id}:${shown.date}`}
          habit={shown.habit}
          date={shown.date}
          log={shown.log}
          onClose={onClose}
        />
      ) : null}
    </BottomSheet>
  );
}

function DayForm({
  habit,
  date,
  log,
  onClose,
}: {
  habit: Habit;
  date: IsoDate;
  log: HabitLog | undefined;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const db = useDb();
  const { colors, radius, spacing } = useTheme();
  const initial: Choice | null =
    log?.status === 'missed'
      ? 'missed'
      : log?.status === 'excused'
        ? 'excused'
        : log
          ? 'done'
          : null;
  const [choice, setChoice] = useState<Choice | null>(initial);
  const [reasonCode, setReasonCode] = useState<MissReason | null>(log?.reasonCode ?? null);
  const [reason, setReason] = useState(log?.reason ?? '');
  const [duration, setDuration] = useState<number | null>(log?.durationMinutes ?? null);

  const save = async () => {
    try {
      if (choice === 'done') {
        await setHabitDone(db, habit.id, date, true);
        // Durée facultative : on ne l'écrit que si elle a changé.
        if (duration !== (log?.durationMinutes ?? null))
          await setHabitDuration(db, habit.id, date, duration);
      } else if (choice === 'missed' || choice === 'excused')
        await setHabitMissed(db, habit.id, date, choice, reasonCode, reason);
      onClose();
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  const clear = async () => {
    const ok = await confirmDestructive(
      t('habits.clearDayTitle'),
      t('habits.clearDayMessage', { name: habit.name }),
      t('common.clear'),
    );
    if (!ok) return;
    try {
      await setHabitDone(db, habit.id, date, false);
      onClose();
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  const option = (value: Choice, label: string, tone: 'success' | 'danger' | 'muted') => {
    const on = choice === value;
    return (
      <Tappable
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        onPress={() => setChoice(value)}
        style={{
          flex: 1,
          minHeight: minTouchSize + 4,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: on ? colors[tone] : colors.border,
          backgroundColor: on ? colors.background : colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.sm,
        }}
      >
        <AppText variant="bodyStrong" color={on ? tone : 'text'}>
          {label}
        </AppText>
      </Tappable>
    );
  };

  return (
    <>
      <View style={{ gap: spacing.xxs }}>
        <AppText variant="heading" accessibilityRole="header">
          {habit.name}
        </AppText>
        <AppText color="muted">{formatShortDate(date, i18n.language)}</AppText>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {option('done', t('habits.done'), 'success')}
        {option('missed', t('habits.missed'), 'danger')}
        {option('excused', t('habits.excused'), 'muted')}
      </View>
      {choice === 'done' ? (
        <ChoiceChips
          label={t('habits.durationOptional')}
          options={[
            { value: null as number | null, label: t('habits.noDuration') },
            ...sessionDurationPresets.map((m) => ({
              value: m as number | null,
              label: formatDuration(m),
            })),
          ]}
          selected={[duration]}
          onToggle={setDuration}
        />
      ) : null}
      {choice === 'missed' || choice === 'excused' ? (
        <>
          <ChoiceChips
            label={t('habits.reasonOptional')}
            options={missReasons.map((r) => ({
              value: r as MissReason | null,
              label: t(`habits.reason.${r}`),
            }))}
            selected={[reasonCode]}
            onToggle={(r) => setReasonCode(reasonCode === r ? null : r)}
          />
          <TextField
            label={t('habits.reasonText')}
            value={reason}
            onChangeText={setReason}
            placeholder={t('common.optional')}
            limit={fieldLimits.note200}
          />
          {choice === 'excused' ? (
            <AppText variant="caption" color="muted">
              {t('habits.excusedHint')}
            </AppText>
          ) : null}
        </>
      ) : null}
      <Button label={t('common.save')} onPress={() => void save()} disabled={choice === null} />
      {log ? (
        <TextButton label={t('habits.clearDay')} color="danger" onPress={() => void clear()} />
      ) : null}
      <TextButton label={t('common.cancel')} onPress={onClose} />
    </>
  );
}
