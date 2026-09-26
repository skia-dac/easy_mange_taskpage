import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  Button,
  ChoiceChips,
  confirmDestructive,
  KeyboardAvoiding,
  showError,
  TextButton,
  TextField,
  fieldLimits,
} from '@/shared/ui';

type Props = {
  habit: Habit | null;
  date: IsoDate;
  log: HabitLog | undefined;
  onClose: () => void;
};

type Choice = 'done' | 'missed' | 'excused';

/**
 * Noter un jour : fait, pas fait ou excusé. La raison est facultative
 * (quelques raisons rapides + un texte libre).
 */
export function HabitDaySheet({ habit, date, log, onClose }: Props) {
  const { t, i18n } = useTranslation();
  const db = useDb();
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
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

  if (!habit) return null;

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
      <Pressable
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
      </Pressable>
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoiding>
        <Pressable
          accessibilityLabel={t('common.cancel')}
          onPress={onClose}
          style={{ flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.xl,
              borderTopRightRadius: radius.xl,
              padding: spacing.xl,
              paddingBottom: spacing.xl + insets.bottom,
              gap: spacing.md,
            }}
          >
            <View style={{ gap: 2 }}>
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
            <Button
              label={t('common.save')}
              onPress={() => void save()}
              disabled={choice === null}
            />
            {log ? (
              <TextButton
                label={t('habits.clearDay')}
                color="danger"
                onPress={() => void clear()}
              />
            ) : null}
            <TextButton label={t('common.cancel')} onPress={onClose} />
          </Pressable>
        </Pressable>
      </KeyboardAvoiding>
    </Modal>
  );
}
