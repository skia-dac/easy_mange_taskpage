import { router, Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/components/navigation';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import { HabitDaySheet } from '@/components/HabitDaySheet';
import { HabitIcon } from '@/components/HabitIcon';
import { frequencyLabel, percent } from '@/components/habitLabels';
import { BodyProgressCard } from '@/components/BodyProgressCard';
import { ProgressHeatmap } from '@/components/ProgressHeatmap';
import { useHabits } from '@/hooks/useHabits';
import { useLabels } from '@/hooks/useLabels';
import { useWeekStart } from '@/hooks/useWeekStart';
import {
  completionRate,
  dayState,
  logOn,
  streak,
  totalDuration,
  type DayState,
} from '@/modules/productivity';
import {
  addDaysIso,
  fromIsoDate,
  startOfWeekOn,
  toIsoDate,
  weekdayOrder,
  type IsoDate,
} from '@/shared/dates';
import { getProgressWidgetHabit, setProgressWidgetHabit } from '@/modules/identity';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatDuration, formatMonthYear, formatShortDate } from '@/shared/format';
import { minTouchSize, useTheme, type ColorTokens } from '@/shared/theme';
import {
  AppText,
  Card,
  confirmDestructive,
  EmptyState,
  LoadingScreen,
  SectionHeader,
  showError,
  TextButton,
} from '@/shared/ui';
import { deleteHabitEverywhere } from '@/workflows';

const STATE_COLORS: Record<DayState, [keyof ColorTokens, keyof ColorTokens]> = {
  done: ['success', 'onPrimary'],
  partial: ['primarySoft', 'primary'],
  missed: ['dangerSoft', 'danger'],
  excused: ['border', 'muted'],
  pending: ['surface', 'text'],
  off: ['background', 'muted'],
};

function monthCells(month: IsoDate, weekStart: number): IsoDate[] {
  const first: IsoDate = `${month.slice(0, 7)}-01`;
  const start = startOfWeekOn(first, weekStart);
  return Array.from({ length: 42 }, (_, i) => addDaysIso(start, i));
}

/** Une habitude : série, taux, calendrier du mois (touche un jour pour le noter), jours manqués et raisons. */
export default function HabitDetailScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const widgetHabit = useLiveQuery(getProgressWidgetHabit, ['app_settings'], []);
  const { colors, radius, spacing } = useTheme();
  const weekStart = useWeekStart();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { habits, logs, loading, today } = useHabits();
  const [month, setMonth] = useState<IsoDate>(today);
  const [sheetDay, setSheetDay] = useState<IsoDate | null>(null);
  const habit = habits.find((h) => h.id === id);

  const cells = useMemo(() => monthCells(month, weekStart), [month, weekStart]);
  if (loading) return <LoadingScreen />;
  if (!habit) return <EmptyState icon="alert-circle" title={t('errors.itemNotFound')} />;

  const s = streak(habit, logs, today, weekStart);
  const rate7 = completionRate(habit, logs, addDaysIso(today, -6), today, today, weekStart);
  const rate30 = completionRate(habit, logs, addDaysIso(today, -29), today, today, weekStart);
  const misses = logs
    .filter((l) => l.habitId === habit.id && (l.status === 'missed' || l.status === 'excused'))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 15);

  const stepMonth = (dir: 1 | -1) => {
    const d = fromIsoDate(month);
    d.setDate(1);
    d.setMonth(d.getMonth() + dir);
    setMonth(toIsoDate(d));
  };

  const remove = async () => {
    const ok = await confirmDestructive(
      t('habits.deleteTitle', { name: habit.name }),
      t('habits.deleteMessage'),
      t('common.delete'),
    );
    if (!ok) return;
    deleteHabitEverywhere(db, habit.id).then(
      () => goBack(),
      (e: unknown) => showError(userMessageKey(e)),
    );
  };

  const monthMinutes = totalDuration(logs, habit.id, `${today.slice(0, 8)}01`, today);

  const tiles = [
    {
      value: t(habit.frequency === 'weekly' ? 'habits.streakWeeks' : 'habits.streakDays', {
        count: s,
      }),
      label: t('habits.streak'),
    },
    { value: percent(rate7), label: t('habits.rate7Label') },
    { value: percent(rate30), label: t('habits.rate30Label') },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen
        options={{
          title: habit.name,
          headerRight: () => (
            <TextButton
              label={t('common.edit')}
              onPress={() => router.push({ pathname: '/habits/form', params: { id: habit.id } })}
            />
          ),
        }}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <HabitIcon icon={habit.icon} colorId={habit.colorId} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title" numberOfLines={2}>
            {habit.name}
          </AppText>
          <AppText color="muted">
            {[
              frequencyLabel(habit, t, labels.weekday),
              habit.target > 1 ? `${habit.target} ${habit.unit ?? ''}` : null,
              habit.reminderTime,
            ]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {tiles.map((tile) => (
          <View key={tile.label} style={{ flex: 1 }}>
            <Card>
              <AppText variant="heading">{tile.value}</AppText>
              <AppText variant="caption" color="muted">
                {tile.label}
              </AppText>
            </Card>
          </View>
        ))}
      </View>

      <ProgressHeatmap habits={[habit]} logs={logs} today={today} />
      {monthMinutes > 0 ? (
        <Card>
          <AppText variant="bodyStrong">
            {t('habits.timeThisMonth', { duration: formatDuration(monthMinutes) })}
          </AppText>
        </Card>
      ) : null}
      {habit.tracksBody ? <BodyProgressCard habitId={habit.id} /> : null}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">{t('progress.widgetTitle')}</AppText>
            <AppText variant="caption" color="muted">
              {t('progress.widgetHint')}
            </AppText>
          </View>
          <Switch
            accessibilityLabel={t('progress.widgetTitle')}
            value={widgetHabit.data === habit.id}
            onValueChange={(on) =>
              void setProgressWidgetHabit(db, on ? habit.id : null).catch((e: unknown) =>
                showError(userMessageKey(e)),
              )
            }
            trackColor={{ true: colors.success, false: colors.border }}
          />
        </View>
      </Card>

      <Card>
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <TextButton label="‹" onPress={() => stepMonth(-1)} />
          <AppText variant="bodyStrong">{formatMonthYear(month, labels.lang)}</AppText>
          <TextButton label="›" onPress={() => stepMonth(1)} />
        </View>
        <View style={{ flexDirection: 'row' }}>
          {weekdayOrder(weekStart).map((n) => (
            <AppText
              key={n}
              variant="caption"
              color="muted"
              style={{ flex: 1, textAlign: 'center' }}
            >
              {labels.weekday(n, 'short')}
            </AppText>
          ))}
        </View>
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <View key={r} style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
            {cells.slice(r * 7, r * 7 + 7).map((d) => {
              const state = dayState(habit, logs, d, today);
              const [bg, fg] = STATE_COLORS[state];
              const inMonth = d.slice(0, 7) === month.slice(0, 7);
              const future = d > today;
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatShortDate(d, labels.lang)} · ${t(`habits.state.${state}`)}`}
                  disabled={future}
                  onPress={() => setSheetDay(d)}
                  style={{
                    flex: 1,
                    minHeight: minTouchSize - 6,
                    borderRadius: radius.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: colors[bg],
                    borderWidth: d === today ? 2 : 0,
                    borderColor: colors.primary,
                    opacity: inMonth ? 1 : 0.35,
                  }}
                >
                  <AppText variant="caption" color={fg}>
                    {String(fromIsoDate(d).getDate())}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ))}
        <AppText variant="caption" color="muted" style={{ marginTop: spacing.sm }}>
          {t('habits.calendarHint')}
        </AppText>
      </Card>

      <SectionHeader title={t('habits.missedDays')} />
      <Card>
        {misses.length === 0 ? <AppText color="muted">{t('habits.noMisses')}</AppText> : null}
        {misses.map((m) => (
          <Pressable
            key={m.id}
            accessibilityRole="button"
            onPress={() => setSheetDay(m.date)}
            style={{ paddingVertical: spacing.sm, gap: 2 }}
          >
            <AppText variant="bodyStrong">
              {`${formatShortDate(m.date, labels.lang)} · ${m.status === 'excused' ? t('habits.excused') : t('habits.missed')}`}
            </AppText>
            <AppText variant="caption" color="muted">
              {[m.reasonCode ? t(`habits.reason.${m.reasonCode}`) : null, m.reason]
                .filter(Boolean)
                .join(' · ') || t('habits.noReason')}
            </AppText>
          </Pressable>
        ))}
      </Card>

      {habit.autoStudy ? (
        <AppText variant="caption" color="muted">
          {t('habits.autoStudyOn')}
        </AppText>
      ) : null}
      <TextButton label={t('habits.delete')} color="danger" onPress={() => void remove()} />
      {sheetDay ? (
        <HabitDaySheet
          habit={habit}
          date={sheetDay}
          log={logOn(logs, habit.id, sheetDay)}
          onClose={() => setSheetDay(null)}
        />
      ) : null}
    </ScrollView>
  );
}
