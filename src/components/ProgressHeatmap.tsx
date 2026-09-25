import type { ReactNode } from 'react';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { useWeekStart } from '@/hooks/useWeekStart';
import type { Habit, HabitLog } from '@/modules/productivity';
import {
  habitLevel,
  heatWeeks,
  overallLevel,
  progressStats,
  type HeatCell,
  type HeatLevel,
  type ProgressScope,
} from '@/projections';
import { fromIsoDate, isoWeekday, type IsoDate } from '@/shared/dates';
import { formatMonthShort } from '@/shared/format';
import { useTheme, type ColorTokens } from '@/shared/theme';
import { AppText, Card, Segmented } from '@/shared/ui';

const HEAT: Record<HeatLevel, keyof ColorTokens> = {
  0: 'heat0',
  1: 'heat1',
  2: 'heat2',
  3: 'heat3',
  4: 'heat4',
};

/**
 * Grille de progression façon GitHub : une habitude (`habit`) ou toutes (`habits`), par
 * semaine, mois ou année. Plus la case est foncée, plus l'objectif du jour est atteint.
 */
export function ProgressHeatmap({
  habits,
  logs,
  today,
  title,
}: {
  habits: readonly Habit[];
  logs: readonly HabitLog[];
  today: IsoDate;
  title?: string;
}) {
  const { t } = useTranslation();
  const labels = useLabels();
  const { colors, radius, spacing } = useTheme();
  const weekStart = useWeekStart();
  const [scope, setScope] = useState<ProgressScope>('year');
  const scroll = useRef<ScrollView>(null);

  const weeks = useMemo(
    () =>
      heatWeeks(scope, today, weekStart, (d) =>
        habits.length === 1
          ? habitLevel(habits[0]!, logs, d, today)
          : overallLevel(habits, logs, d, today),
      ),
    [scope, today, weekStart, habits, logs],
  );
  const stats = progressStats(weeks);

  const cellColor = (c: HeatCell) =>
    c.future || c.outside ? 'transparent' : colors[HEAT[c.level ?? 0]];
  const border = (c: HeatCell) => (c.future && !c.outside ? colors.border : 'transparent');
  const a11y = (c: HeatCell) =>
    `${c.date} : ${c.level === null ? t('progress.noGoal') : t(`progress.level${c.level}`)}`;

  const letters = weeks[0]!.map((c) =>
    labels.weekday(isoWeekday(c.date), 'short').slice(0, 1).toLocaleUpperCase(),
  );

  let grid: ReactNode;
  if (scope === 'year') {
    const size = 12;
    const gap = 3;
    grid = (
      <View style={{ flexDirection: 'row', gap: spacing.xs }}>
        <View style={{ gap, paddingTop: 16 }}>
          {letters.map((l, i) => (
            <AppText
              key={i}
              variant="label"
              color="muted"
              style={{ height: size, lineHeight: size, opacity: i % 2 === 0 ? 1 : 0 }}
            >
              {l}
            </AppText>
          ))}
        </View>
        <ScrollView
          ref={scroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
        >
          <View style={{ flexDirection: 'row', gap }}>
            {weeks.map((week, w) => {
              const first = week[0]!.date;
              const showMonth = w === 0 || first.slice(5, 7) !== weeks[w - 1]![0]!.date.slice(5, 7);
              return (
                <View key={first} style={{ gap }}>
                  <AppText
                    variant="label"
                    color="muted"
                    numberOfLines={1}
                    style={{ height: 13, width: size * 3, marginRight: -size * 2 }}
                  >
                    {showMonth ? formatMonthShort(first, labels.lang) : ''}
                  </AppText>
                  {week.map((c) => (
                    <View
                      key={c.date}
                      accessibilityLabel={a11y(c)}
                      style={{
                        width: size,
                        height: size,
                        borderRadius: 3,
                        backgroundColor: cellColor(c),
                        borderWidth: 1,
                        borderColor: border(c),
                      }}
                    />
                  ))}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  } else {
    grid = (
      <View style={{ gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {letters.map((l, i) => (
            <AppText key={i} variant="label" color="muted" style={{ flex: 1, textAlign: 'center' }}>
              {l}
            </AppText>
          ))}
        </View>
        {weeks.map((week) => (
          <View key={week[0]!.date} style={{ flexDirection: 'row', gap: spacing.xs }}>
            {week.map((c) => (
              <View
                key={c.date}
                accessibilityLabel={c.outside ? undefined : a11y(c)}
                style={{
                  flex: 1,
                  aspectRatio: 1,
                  borderRadius: radius.sm,
                  backgroundColor: cellColor(c),
                  borderWidth: 1,
                  borderColor: border(c),
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {c.outside ? null : (
                  <AppText
                    variant="caption"
                    style={{
                      color: (c.level ?? 0) >= 3 && !c.future ? colors.onPrimary : colors.muted,
                    }}
                  >
                    {String(fromIsoDate(c.date).getDate())}
                  </AppText>
                )}
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }

  return (
    <Card>
      <View style={{ gap: spacing.md }}>
        {title ? <AppText variant="heading">{title}</AppText> : null}
        <Segmented
          value={scope}
          onChange={setScope}
          accessibilityLabel={t('progress.scope')}
          options={[
            { value: 'week', label: t('progress.week') },
            { value: 'month', label: t('progress.month') },
            { value: 'year', label: t('progress.year') },
          ]}
        />
        {grid}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: spacing.sm,
          }}
        >
          <AppText variant="caption" color="muted" style={{ flex: 1 }}>
            {t('progress.summary', {
              done: stats.doneDays,
              total: stats.expectedDays,
              best: stats.bestRun,
            })}
          </AppText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <AppText variant="label" color="muted">
              {t('progress.less')}
            </AppText>
            {([0, 1, 2, 3, 4] as const).map((l) => (
              <View
                key={l}
                style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colors[HEAT[l]] }}
              />
            ))}
            <AppText variant="label" color="muted">
              {t('progress.more')}
            </AppText>
          </View>
        </View>
      </View>
    </Card>
  );
}
