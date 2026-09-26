import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  addHabitCount,
  dayState,
  doneInWeek,
  isDone,
  logOn,
  setHabitDone,
  streak,
  type Habit,
  type HabitLog,
} from '@/modules/productivity';
import { formatDuration } from '@/shared/format';
import { startOfWeekOn, type IsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { minTouchSize, useTheme } from '@/shared/theme';
import { AppText, Checkbox, CheckPop, Settle, showError, showUndoToast } from '@/shared/ui';

import { HabitIcon } from './HabitIcon';

type Props = {
  habit: Habit;
  logs: readonly HabitLog[];
  day: IsoDate;
  today: IsoDate;
  weekStart: number;
  /** Ouvre la fiche du jour (pas fait, raison, excusé). */
  onMore: (habit: Habit) => void;
};

/** Une habitude pour un jour : icône, progression, série, et un geste pour cocher (ou +1). */
export function HabitRow({ habit, logs, day, today, weekStart, onMore }: Props) {
  const { t } = useTranslation();
  const db = useDb();
  const { colors, radius, spacing } = useTheme();
  const log = logOn(logs, habit.id, day);
  const done = isDone(habit, log);
  const state = dayState(habit, logs, day, today);
  const count = log?.status === 'done' ? log.count : 0;
  const s = streak(habit, logs, today, weekStart);
  const fail = (e: unknown) => showError(userMessageKey(e));

  const progress =
    habit.target > 1
      ? t('habits.progressCount', { count, target: habit.target, unit: habit.unit ?? '' })
      : habit.frequency === 'weekly'
        ? t('habits.progressWeek', {
            done: doneInWeek(habit, logs, startOfWeekOn(day, weekStart)),
            target: habit.timesPerWeek,
          })
        : state === 'missed'
          ? t('habits.missed')
          : state === 'excused'
            ? t('habits.excused')
            : null;
  const subtitle = [
    progress,
    log?.durationMinutes ? formatDuration(log.durationMinutes) : null,
    s > 0
      ? t(habit.frequency === 'weekly' ? 'habits.streakWeeks' : 'habits.streakDays', { count: s })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Settle done={done}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          paddingVertical: spacing.sm,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={habit.name}
          onPress={() => router.push({ pathname: '/habits/[id]', params: { id: habit.id } })}
          onLongPress={() => onMore(habit)}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <HabitIcon icon={habit.icon} colorId={habit.colorId} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText
              variant="bodyStrong"
              numberOfLines={1}
              style={done ? { textDecorationLine: 'line-through', color: colors.muted } : undefined}
            >
              {habit.name}
            </AppText>
            {subtitle ? (
              <AppText
                variant="caption"
                color={state === 'missed' ? 'danger' : 'muted'}
                numberOfLines={1}
              >
                {subtitle}
              </AppText>
            ) : null}
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('habits.more', { name: habit.name })}
          onPress={() => onMore(habit)}
          style={{
            width: minTouchSize - 8,
            height: minTouchSize,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="more-horizontal" size={20} color={colors.muted} />
        </Pressable>
        {habit.target > 1 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('habits.addOne', { name: habit.name })}
            disabled={done}
            onPress={() =>
              addHabitCount(db, habit.id, day, 1).then(
                () =>
                  showUndoToast(t('habits.addOneToast', { name: habit.name }), () =>
                    addHabitCount(db, habit.id, day, -1),
                  ),
                fail,
              )
            }
            style={({ pressed }) => ({
              minWidth: minTouchSize,
              height: minTouchSize,
              borderRadius: radius.md,
              backgroundColor: done ? colors.successSoft : colors.primarySoft,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: spacing.sm,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <CheckPop checked={done}>
              {done ? (
                <Feather name="check" size={20} color={colors.success} />
              ) : (
                <AppText variant="bodyStrong" color="primary">
                  +1
                </AppText>
              )}
            </CheckPop>
          </Pressable>
        ) : (
          <Checkbox
            checked={done}
            accessibilityLabel={habit.name}
            onToggle={() => setHabitDone(db, habit.id, day, !done).catch(fail)}
          />
        )}
      </View>
    </Settle>
  );
}
