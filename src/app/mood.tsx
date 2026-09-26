import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { BarChart } from '@/components/BarChart';
import { HabitIcon } from '@/components/HabitIcon';
import { MoodPicker } from '@/components/MoodPicker';
import { useLabels } from '@/hooks/useLabels';
import { energyEmoji, moodEmoji } from '@/modules/productivity';
import { moodInsights, useAgendaData } from '@/projections';
import { addDaysIso, isoWeekday, toIsoDate } from '@/shared/dates';
import { formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { useNow } from '@/shared/useNow';
import { AppText, Card, ListRow, LoadingScreen, SectionHeader } from '@/shared/ui';

const fmt = (v: number | null, lang: string) =>
  v === null ? '—' : v.toLocaleString(lang, { maximumFractionDigits: 1 });

/** Journal d'humeur et d'énergie : aujourd'hui, les 7 derniers jours, et le lien avec les habitudes. */
export default function MoodScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { spacing } = useTheme();
  const now = useNow(60_000);
  const today = toIsoDate(now);
  const agenda = useAgendaData();
  const logs = useMemo(() => agenda.data?.moodLogs ?? [], [agenda.data]);
  const insights = useMemo(
    () => moodInsights(logs, agenda.data?.habits ?? [], agenda.data?.habitLogs ?? [], today),
    [logs, agenda.data, today],
  );

  if (agenda.loading) return <LoadingScreen />;
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(today, i - 6));
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const recent = [...logs].reverse().slice(0, 14);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('mood.title') }} />
      <SectionHeader title={t('mood.today')} />
      <MoodPicker date={today} />

      <SectionHeader title={t('mood.week')} />
      <Card>
        <AppText color="muted">
          {insights.week.days === 0
            ? t('mood.noData')
            : t('mood.averages', {
                mood: fmt(insights.week.mood, labels.lang),
                energy: fmt(insights.week.energy, labels.lang),
              })}
        </AppText>
        <BarChart
          bars={days.map((d) => ({
            label: labels.weekday(isoWeekday(d), 'short'),
            value: byDate.get(d)?.energy ?? 0,
            tone: d === today ? ('primary' as const) : ('muted' as const),
          }))}
          max={5}
          height={70}
          valueLabel={(v) => (v > 0 ? (energyEmoji[v] ?? '') : '')}
          accessibilityLabel={t('mood.energyChart')}
        />
      </Card>

      <SectionHeader title={t('mood.habitsTitle')} />
      {insights.habits.length === 0 ? (
        <AppText color="muted">{t('mood.habitsEmpty')}</AppText>
      ) : (
        <>
          <Card>
            {insights.habits.map((h) => (
              <ListRow
                key={h.habit.id}
                title={h.habit.name}
                subtitle={t('mood.habitLine', {
                  done: fmt(h.energyDone, labels.lang),
                  missed: fmt(h.energyMissed, labels.lang),
                })}
                leading={<HabitIcon icon={h.habit.icon} colorId={h.habit.colorId} />}
              />
            ))}
          </Card>
          <AppText variant="caption" color="muted">
            {t('mood.habitsHint')}
          </AppText>
        </>
      )}

      {recent.length > 0 ? (
        <>
          <SectionHeader title={t('mood.recent')} />
          <Card>
            {recent.map((l) => (
              <View key={l.id}>
                <ListRow
                  title={formatShortDate(l.date, labels.lang)}
                  subtitle={l.note}
                  trailing={
                    <AppText style={{ fontSize: 20, lineHeight: 26 }}>
                      {`${moodEmoji[l.mood] ?? ''} ${energyEmoji[l.energy] ?? ''}`}
                    </AppText>
                  }
                />
              </View>
            ))}
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}
