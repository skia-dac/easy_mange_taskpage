import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import type { Subject } from '@/modules/academic';
import { formatMoney } from '@/modules/finance';
import { isDone, logOn, type Habit, type HabitLog } from '@/modules/productivity';
import { useWeekStart } from '@/hooks/useWeekStart';
import { DEFAULT_WORK_WEEK_HOURS, getWorkWeekHours } from '@/modules/identity';
import {
  coursesToday,
  doneThisWeek,
  glanceTiles,
  meetingsToday,
  revisionWeek,
  useMoneyData,
  workWeek,
  type GlanceTileId,
  type TodayData,
  type TodayView,
} from '@/projections';
import { startOfWeekOn } from '@/shared/dates';
import { useLiveQuery } from '@/shared/db';
import { formatDuration } from '@/shared/format';
import { useSpaces } from '@/shared/SpacesContext';
import { useTheme, type ColorTokens } from '@/shared/theme';
import { AppText } from '@/shared/ui';

/**
 * Les 4 tuiles d'un coup d'œil en haut d'Aujourd'hui, choisies selon les espaces actifs
 * (argent, habitudes, à faire, examen, à planifier, cours, révision, réunions…).
 * Chaque tuile ouvre son module.
 */
export function TodayGlance({
  view,
  data,
  habits,
  habitLogs,
  subjects,
}: {
  view: TodayView;
  data: TodayData;
  habits: readonly Habit[];
  habitLogs: readonly HabitLog[];
  subjects: ReadonlyMap<string, Subject>;
}) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const spaces = useSpaces();
  const weekStart = useWeekStart();
  const moneyQ = useMoneyData(0);
  const money = moneyQ.data?.overview;
  const hoursQ = useLiveQuery(getWorkWeekHours, ['app_settings'], []);
  const weekFrom = startOfWeekOn(view.today, weekStart);

  const doneHabits = habits.filter((h) => isDone(h, logOn(habitLogs, h.id, view.today))).length;
  const todoCount = view.overdue.length + view.dueToday.length;
  const exam = view.upcomingExams[0];
  const examWhen = exam
    ? exam.countdown.kind === 'today'
      ? t('countdown.today')
      : exam.countdown.kind === 'tomorrow'
        ? t('countdown.tomorrow')
        : t('glance.days', { count: exam.countdown.kind === 'inDays' ? exam.countdown.days : 0 })
    : null;
  const moneyStarted = !!money && (money.items.length > 0 || money.carryOver !== 0);

  const tiles: Record<GlanceTileId, () => ReactNode> = {
    money: () => (
      <Tile
        key="money"
        href="/(tabs)/money"
        label={t('glance.money')}
        labelColor="success"
        a11y={
          moneyStarted && money
            ? t('glance.moneyA11y', { amount: formatMoney(money.balance, money.currency) })
            : t('glance.money')
        }
      >
        {moneyStarted && money ? (
          <>
            <AppText variant="heading" numberOfLines={1} adjustsFontSizeToFit>
              {formatMoney(money.balance, money.currency)}
            </AppText>
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {t('glance.perDay', { amount: formatMoney(money.perDay, money.currency) })}
            </AppText>
          </>
        ) : moneyQ.loading ? null : (
          <AppText variant="caption" color="muted">
            {t('glance.moneyStart')}
          </AppText>
        )}
      </Tile>
    ),
    habits: () => (
      <Tile
        key="habits"
        href="/habits"
        a11y={
          habits.length > 0
            ? t('glance.habitsA11y', { done: doneHabits, total: habits.length })
            : t('glance.habits')
        }
        row
      >
        <Ring done={doneHabits} total={habits.length} />
        <AppText variant="bodyStrong" style={{ flex: 1 }}>
          {habits.length > 0 ? t('glance.habits') : t('glance.habitsStart')}
        </AppText>
      </Tile>
    ),
    todo: () => (
      <Tile
        key="todo"
        href="/(tabs)/tasks"
        label={t('glance.todo')}
        labelColor="primary"
        a11y={t('glance.todoA11y', { count: todoCount, overdue: view.overdue.length })}
      >
        <AppText variant="heading">{String(todoCount)}</AppText>
        {view.overdue.length > 0 ? (
          <AppText variant="caption" color="danger" style={{ fontWeight: '700' }}>
            {t('glance.overdue', { count: view.overdue.length })}
          </AppText>
        ) : (
          <AppText variant="caption" color="muted">
            {todoCount > 0 ? t('glance.onTime') : t('glance.nothingTodo')}
          </AppText>
        )}
      </Tile>
    ),
    exam: () => (
      <Tile
        key="exam"
        href={
          exam
            ? { pathname: '/exams/[id]', params: { id: exam.exam.id } }
            : { pathname: '/exams/form', params: {} }
        }
        label={t('glance.exam')}
        labelColor={exam ? 'danger' : 'muted'}
        background={exam ? 'dangerSoft' : 'surface'}
        a11y={
          exam && examWhen
            ? `${t('glance.exam')} : ${subjects.get(exam.exam.subjectId)?.name ?? ''}, ${examWhen}`
            : t('glance.noExam')
        }
      >
        {exam && examWhen ? (
          <>
            <AppText variant="heading" color="danger" numberOfLines={1}>
              {examWhen}
            </AppText>
            <AppText variant="caption" color="muted" numberOfLines={1}>
              {exam.exam.title ?? subjects.get(exam.exam.subjectId)?.name ?? ''}
            </AppText>
          </>
        ) : (
          <AppText variant="caption" color="muted">
            {t('glance.noExam')}
          </AppText>
        )}
      </Tile>
    ),
    plan: () => {
      const w = workWeek(data, weekFrom, hoursQ.data ?? DEFAULT_WORK_WEEK_HOURS);
      const toPlan = formatDuration(w.toPlanMinutes);
      const summary = t('glance.planOf', {
        planned: formatDuration(w.plannedMinutes),
        target: formatDuration(w.targetMinutes),
      });
      return (
        <Tile
          key="plan"
          href="/(tabs)/calendar"
          label={t('glance.plan')}
          labelColor="primary"
          background="primarySoft"
          a11y={`${t('glance.plan')} : ${toPlan}, ${summary}`}
        >
          <AppText variant="heading" color="primary">
            {w.toPlanMinutes > 0 ? toPlan : t('glance.planFull')}
          </AppText>
          <AppText variant="caption" color="muted" numberOfLines={2}>
            {summary}
          </AppText>
        </Tile>
      );
    },
    courses: () => {
      const c = coursesToday(view);
      return (
        <Tile
          key="courses"
          href="/(tabs)/calendar"
          label={t('glance.courses')}
          labelColor="primary"
          a11y={`${t('glance.courses')} : ${c.count}`}
        >
          <AppText variant="heading">{String(c.count)}</AppText>
          <AppText variant="caption" color="muted" numberOfLines={1}>
            {c.count > 0 && c.endsAt
              ? t('glance.coursesHint', { duration: formatDuration(c.minutes), end: c.endsAt })
              : t('glance.noCourses')}
          </AppText>
        </Tile>
      );
    },
    revision: () => {
      const r = revisionWeek(data, weekFrom);
      return (
        <Tile
          key="revision"
          href="/study"
          label={t('glance.revision')}
          labelColor="success"
          a11y={`${t('glance.revision')} : ${formatDuration(r.doneMinutes)} / ${formatDuration(r.plannedMinutes)}`}
        >
          <AppText variant="heading" numberOfLines={1} adjustsFontSizeToFit>
            {r.plannedMinutes > 0
              ? `${formatDuration(r.doneMinutes)} / ${formatDuration(r.plannedMinutes)}`
              : formatDuration(r.doneMinutes)}
          </AppText>
          <AppText variant="caption" color="muted">
            {t('glance.thisWeek')}
          </AppText>
        </Tile>
      );
    },
    meetings: () => {
      const m = meetingsToday(view);
      return (
        <Tile
          key="meetings"
          href="/(tabs)/calendar"
          label={t('glance.meetings')}
          labelColor="warning"
          background="warningSoft"
          a11y={`${t('glance.meetings')} : ${m.count}`}
        >
          <AppText variant="heading" color="warning">
            {String(m.count)}
          </AppText>
          <AppText variant="caption" color="muted">
            {m.count > 0
              ? t('glance.meetingsHint', { duration: formatDuration(m.minutes) })
              : t('glance.noMeetings')}
          </AppText>
        </Tile>
      );
    },
    doneWeek: () => {
      const n = doneThisWeek(data, weekFrom);
      return (
        <Tile
          key="doneWeek"
          href="/(tabs)/tasks"
          label={t('glance.doneWeek')}
          labelColor="success"
          a11y={`${t('glance.doneWeek')} : ${n}`}
        >
          <AppText variant="heading">{String(n)}</AppText>
          <AppText variant="caption" color="muted">
            {t('glance.doneWeekHint')}
          </AppText>
        </Tile>
      );
    },
    due: () => {
      const next = money?.due.find((d) => !d.paid && d.date >= view.today);
      return (
        <Tile
          key="due"
          href="/money/recurring"
          label={t('glance.due')}
          labelColor="warning"
          background={next ? 'warningSoft' : 'surface'}
          a11y={
            next && money
              ? `${t('glance.due')} : ${next.recurring.name}, ${formatMoney(next.amountMinor, money.currency)}`
              : t('glance.noDue')
          }
        >
          {next && money ? (
            <>
              <AppText variant="heading" color="warning" numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(next.amountMinor, money.currency)}
              </AppText>
              <AppText variant="caption" color="muted" numberOfLines={1}>
                {next.recurring.name}
              </AppText>
            </>
          ) : (
            <AppText variant="caption" color="muted">
              {t('glance.noDue')}
            </AppText>
          )}
        </Tile>
      );
    },
  };

  const ids = glanceTiles(spaces.active);
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {ids.slice(0, 2).map((id) => tiles[id]())}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {ids.slice(2, 4).map((id) => tiles[id]())}
      </View>
    </View>
  );
}

function Tile({
  href,
  label,
  labelColor = 'muted',
  background = 'surface',
  a11y,
  row = false,
  children,
}: {
  href: Href;
  label?: string;
  labelColor?: keyof ColorTokens;
  background?: keyof ColorTokens;
  a11y: string;
  row?: boolean;
  children: ReactNode;
}) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={() => router.navigate(href)}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 96,
        borderRadius: radius.lg,
        backgroundColor: colors[background],
        paddingHorizontal: spacing.md + 2,
        paddingVertical: spacing.md,
        gap: row ? spacing.md : 2,
        flexDirection: row ? 'row' : 'column',
        alignItems: row ? 'center' : 'stretch',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {label ? (
        <AppText variant="label" color={labelColor} style={{ letterSpacing: 0.5 }}>
          {label.toLocaleUpperCase()}
        </AppText>
      ) : null}
      {children}
    </Pressable>
  );
}

/** Anneau de progression des habitudes du jour (« 1/3 »). */
function Ring({ done, total }: { done: number; total: number }) {
  const { colors } = useTheme();
  const size = 52;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const length = 2 * Math.PI * r;
  const part = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.primarySoft}
          strokeWidth={stroke}
          fill="none"
        />
        {part > 0 ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={part >= 1 ? colors.success : colors.primary}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${length * part} ${length}`}
            fill="none"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>
      <AppText variant="caption" style={{ fontWeight: '700' }}>
        {total > 0 ? `${done}/${total}` : '+'}
      </AppText>
    </View>
  );
}
