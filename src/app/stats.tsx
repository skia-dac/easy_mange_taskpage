import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { BarChart } from '@/components/BarChart';
import { useLabels } from '@/hooks/useLabels';
import { useWeekStart } from '@/hooks/useWeekStart';
import { listStudySessions } from '@/modules/productivity';
import { useAgendaData, weekStats } from '@/projections';
import { addDaysIso, startOfWeekOn, toIsoDate, weekdayOrder } from '@/shared/dates';
import { useLiveQuery } from '@/shared/db';
import { formatDuration, formatShortDate } from '@/shared/format';
import { useTheme, type ColorTokens } from '@/shared/theme';
import { useNow } from '@/shared/useNow';
import { AppText, Card, IconBadge, LoadingScreen } from '@/shared/ui';

type Stat = {
  icon: ComponentProps<typeof Feather>['name'];
  color: keyof ColorTokens;
  background: keyof ColorTokens;
  value: string;
  label: string;
};

/** Statistiques de la semaine : calculées à la volée à partir des données. */
export default function StatsScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { spacing } = useTheme();
  const now = useNow(60_000);
  const weekStartDay = useWeekStart();
  const today = toIsoDate(now);
  const from = startOfWeekOn(today, weekStartDay);
  const agenda = useAgendaData();
  // 400 jours en arrière pour la série de jours actifs.
  const sessions = useLiveQuery(
    (db) => listStudySessions(db, addDaysIso(today, -400), addDaysIso(from, 6)),
    ['study_sessions'],
    [today, from],
  );
  const stats = useMemo(
    () => (agenda.data ? weekStats(agenda.data, sessions.data ?? [], from, now) : null),
    [agenda.data, sessions.data, from, now],
  );

  if (!stats) return <LoadingScreen />;

  const cards: Stat[] = [
    {
      icon: 'book-open',
      color: 'primary',
      background: 'primarySoft',
      value: formatDuration(stats.courseMinutes),
      label: t('stats.courses'),
    },
    {
      icon: 'check-square',
      color: 'success',
      background: 'successSoft',
      value: String(stats.tasksDone),
      label: t('stats.tasksDone', { open: stats.tasksOpen }),
    },
    {
      icon: 'clock',
      color: 'primary',
      background: 'primarySoft',
      value: formatDuration(stats.studyMinutes),
      label: t('stats.study'),
    },
    {
      icon: 'zap',
      color: 'warning',
      background: 'warningSoft',
      value: t('stats.streakValue', { count: stats.streakDays }),
      label: t('stats.streak'),
    },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <AppText color="muted">
        {t('stats.range', {
          from: formatShortDate(stats.from, labels.lang),
          to: formatShortDate(stats.to, labels.lang),
        })}
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {cards.map((c) => (
          <View key={c.label} style={{ width: '48%', flexGrow: 1 }}>
            <Card>
              <View style={{ gap: spacing.sm }}>
                <IconBadge icon={c.icon} color={c.color} background={c.background} />
                <AppText variant="title">{c.value}</AppText>
                <AppText variant="caption" color="muted">
                  {c.label}
                </AppText>
              </View>
            </Card>
          </View>
        ))}
      </View>
      <Card>
        <AppText variant="bodyStrong">{t('stats.studyByDay')}</AppText>
        <BarChart
          bars={weekdayOrder(weekStartDay).map((n, i) => {
            const d = stats.studyByDay[i];
            return {
              label: labels.weekday(n, 'short'),
              value: d?.minutes ?? 0,
              tone: d?.day === today ? 'primary' : 'muted',
            };
          })}
          max={Math.max(60, ...stats.studyByDay.map((d) => d.minutes))}
          height={90}
          valueLabel={(v) => (v > 0 ? formatDuration(v) : '')}
          accessibilityLabel={t('stats.studyByDay')}
        />
      </Card>
      <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
        {t('stats.hint')}
      </AppText>
    </ScrollView>
  );
}
