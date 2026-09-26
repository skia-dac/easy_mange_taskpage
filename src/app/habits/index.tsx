import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HabitDaySheet } from '@/components/HabitDaySheet';
import { HabitIcon } from '@/components/HabitIcon';
import { frequencyLabel, percent } from '@/components/habitLabels';
import { HabitRow } from '@/components/HabitRow';
import { ProgressHeatmap } from '@/components/ProgressHeatmap';
import { useHabits } from '@/hooks/useHabits';
import { useLabels } from '@/hooks/useLabels';
import { useWeekStart } from '@/hooks/useWeekStart';
import {
  completionRate,
  createHabit,
  habitSuggestions,
  isScheduledOn,
  logOn,
  topReasons,
  weeklyReview,
  type Habit,
} from '@/modules/productivity';
import { addDaysIso, startOfWeekOn } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Card,
  Chip,
  EmptyState,
  Fab,
  FAB_CLEARANCE,
  ListRow,
  LoadingScreen,
  SectionHeader,
  Segmented,
  showError,
  TextButton,
} from '@/shared/ui';

/** Tableau des habitudes : aujourd'hui, bilan de la semaine (respecté / pas respecté, raisons), toutes les habitudes. */
export default function HabitsScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const weekStart = useWeekStart();
  const { habits, logs, loading, today } = useHabits();
  const [sheet, setSheet] = useState<Habit | null>(null);
  const [week, setWeek] = useState<'current' | 'previous'>('current');

  const thisWeek = startOfWeekOn(today, weekStart);
  const weekFrom = week === 'current' ? thisWeek : addDaysIso(thisWeek, -7);
  const review = useMemo(
    () => weeklyReview(habits, logs, weekFrom, today),
    [habits, logs, weekFrom, today],
  );
  const reasons = topReasons(review);
  const respected = review.filter((r) => r.respected).length;
  const todays = habits.filter((h) => isScheduledOn(h, today));
  const suggestions = habitSuggestions.filter(
    (s) => !habits.some((h) => h.name === t(`habits.suggest.${s.key}`)),
  );

  if (loading) return <LoadingScreen />;

  const addSuggestion = (s: (typeof habitSuggestions)[number]) =>
    createHabit(db, {
      ...s,
      name: t(`habits.suggest.${s.key}`),
      unit: s.target && s.target > 1 ? t(`habits.suggestUnit.${s.key}`) : null,
    }).catch((e: unknown) => showError(userMessageKey(e)));

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: t('habits.title') }} />
      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          gap: spacing.lg,
          paddingBottom: FAB_CLEARANCE + insets.bottom,
        }}
      >
        {habits.length === 0 ? (
          <EmptyState icon="target" title={t('habits.empty')} message={t('habits.emptyHint')} />
        ) : null}

        {todays.length > 0 ? (
          <>
            <SectionHeader title={t('habits.today')} />
            <Card>
              {todays.map((h) => (
                <HabitRow
                  key={h.id}
                  habit={h}
                  logs={logs}
                  day={today}
                  today={today}
                  weekStart={weekStart}
                  onMore={setSheet}
                />
              ))}
            </Card>
          </>
        ) : null}

        {habits.length > 0 ? (
          <>
            <SectionHeader title={t('progress.title')} />
            <ProgressHeatmap habits={habits} logs={logs} today={today} />
            <SectionHeader title={t('habits.review')} />
            <Segmented
              value={week}
              onChange={setWeek}
              options={[
                { value: 'current', label: t('habits.thisWeek') },
                { value: 'previous', label: t('habits.lastWeek') },
              ]}
            />
            <Card>
              <View style={{ gap: spacing.sm }}>
                <AppText variant="heading">
                  {t('habits.respectedCount', { count: respected, total: review.length })}
                </AppText>
                <AppText variant="caption" color="muted">
                  {t('habits.weekRange', {
                    from: formatShortDate(weekFrom, labels.lang),
                    to: formatShortDate(addDaysIso(weekFrom, 6), labels.lang),
                  })}
                </AppText>
                {review.map((r) => {
                  const h = habits.find((x) => x.id === r.habitId);
                  return (
                    <View key={r.habitId} style={{ gap: 4, paddingVertical: spacing.xs }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        {h ? <HabitIcon icon={h.icon} colorId={h.colorId} size={28} /> : null}
                        <AppText variant="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>
                          {r.name}
                        </AppText>
                        <Chip
                          label={`${Math.min(r.done, r.expected)}/${r.expected}`}
                          tone={r.respected ? 'success' : r.misses.length > 0 ? 'danger' : 'muted'}
                        />
                      </View>
                      {r.misses.map((m) => (
                        <AppText
                          key={m.date}
                          variant="caption"
                          color="muted"
                          style={{ marginLeft: 36 }}
                        >
                          {[
                            formatShortDate(m.date, labels.lang),
                            m.reasonCode ? t(`habits.reason.${m.reasonCode}`) : null,
                            m.reason,
                          ]
                            .filter(Boolean)
                            .join(' · ') || t('habits.noReason')}
                        </AppText>
                      ))}
                    </View>
                  );
                })}
                {reasons.length > 0 ? (
                  <AppText variant="caption" color="muted">
                    {t('habits.topReasons', {
                      list: reasons
                        .map((r) => `${t(`habits.reason.${r.code}`)} (${r.count})`)
                        .join(', '),
                    })}
                  </AppText>
                ) : null}
              </View>
            </Card>

            <SectionHeader title={t('habits.all')} />
            <Card>
              {habits.map((h) => (
                <ListRow
                  key={h.id}
                  title={h.name}
                  subtitle={[
                    frequencyLabel(h, t, labels.weekday),
                    t('habits.rate30', {
                      rate: percent(
                        completionRate(h, logs, addDaysIso(today, -29), today, today, weekStart),
                      ),
                    }),
                  ].join(' · ')}
                  leading={<HabitIcon icon={h.icon} colorId={h.colorId} size={32} />}
                  onPress={() => router.push({ pathname: '/habits/[id]', params: { id: h.id } })}
                />
              ))}
            </Card>
          </>
        ) : null}

        {suggestions.length > 0 ? (
          <>
            <SectionHeader title={t('habits.suggestions')} />
            <Card>
              {suggestions.map((s) => (
                <ListRow
                  key={s.key}
                  title={t(`habits.suggest.${s.key}`)}
                  subtitle={frequencyLabel(
                    {
                      frequency: s.frequency ?? 'daily',
                      weekdays: s.weekdays ?? [],
                      timesPerWeek: s.timesPerWeek ?? 1,
                    },
                    t,
                    labels.weekday,
                  )}
                  leading={
                    <HabitIcon
                      icon={s.icon ?? 'check-circle'}
                      colorId={s.colorId ?? 'blue'}
                      size={32}
                    />
                  }
                  trailing={
                    <TextButton label={t('common.add')} onPress={() => void addSuggestion(s)} />
                  }
                />
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
      <Fab accessibilityLabel={t('habits.new')} onPress={() => router.push('/habits/form')} />
      {sheet ? (
        <HabitDaySheet
          habit={sheet}
          date={today}
          log={logOn(logs, sheet.id, today)}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}
