import Feather from '@expo/vector-icons/Feather';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { eventHref } from '@/components/eventHref';
import { calendarItemKey, CalendarItemRow } from '@/components/CalendarItemRow';
import { ExportCalendarButton } from '@/components/ExportCalendarButton';
import { SearchButton } from '@/components/SearchButton';
import { WeekHoursGrid } from '@/components/WeekHoursGrid';
import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import { useWeekStart } from '@/hooks/useWeekStart';
import {
  calendarDays,
  calendarFilters,
  filterItems,
  useAgendaData,
  type CalendarFilter,
  type CalendarItem,
  type MoveTarget,
} from '@/projections';
import {
  addDaysIso,
  fromIsoDate,
  startOfWeekOn,
  toIsoDate,
  weekdayOrder,
  type IsoDate,
} from '@/shared/dates';
import { isSlotEvent } from '@/modules/productivity';
import { useSpaces } from '@/shared/SpacesContext';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatLongDate, formatMonthYear, formatShortDate } from '@/shared/format';
import { minTouchSize, useTheme } from '@/shared/theme';
import { useNow } from '@/shared/useNow';
import {
  AppText,
  Card,
  ChoiceChips,
  confirmAction,
  EmptyState,
  Fab,
  Screen,
  Segmented,
  SectionHeader,
  showError,
  showInfo,
} from '@/shared/ui';
import { moveCalendarItem } from '@/workflows';

type ViewMode = 'day' | 'week' | 'hours' | 'month';
const viewModes: readonly ViewMode[] = ['day', 'week', 'hours', 'month'];

function monthGrid(anyDay: IsoDate, weekStartDay: number): IsoDate[] {
  const first = `${anyDay.slice(0, 7)}-01`;
  const start = startOfWeekOn(first, weekStartDay);
  return Array.from({ length: 42 }, (_, i) => addDaysIso(start, i));
}

export default function CalendarScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { colors, spacing } = useTheme();
  const now = useNow(60_000);
  const today = toIsoDate(now);
  const db = useDb();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<ViewMode>(
    viewModes.includes(params.mode as ViewMode) ? (params.mode as ViewMode) : 'day',
  );
  const [shown, setShown] = useState<ReadonlySet<CalendarFilter>>(new Set(calendarFilters));
  const [selected, setSelected] = useState<IsoDate>(today);
  const agenda = useAgendaData();
  const spaces = useSpaces();
  const study = spaces.has('study');
  // Sans Études : ni cours, ni examens, ni révisions à filtrer.
  const filterChoices = calendarFilters.filter((f) => study || f === 'work' || f === 'event');
  const { byId } = useSubjects();
  const weekStartDay = useWeekStart();

  const weekStart = startOfWeekOn(selected, weekStartDay);
  const range = useMemo(() => {
    if (mode === 'month') {
      const grid = monthGrid(selected, weekStartDay);
      return { from: grid[0]!, to: grid[41]! };
    }
    return { from: weekStart, to: addDaysIso(weekStart, 6) };
  }, [mode, selected, weekStart, weekStartDay]);

  const days = useMemo(() => {
    if (!agenda.data) return new Map<IsoDate, CalendarItem[]>();
    const all = calendarDays(agenda.data, range.from, range.to);
    if (shown.size === calendarFilters.length) return all;
    return new Map([...all].map(([d, items]) => [d, filterItems(items, shown)]));
  }, [agenda.data, range.from, range.to, shown]);

  const toggleFilter = (f: CalendarFilter) =>
    setShown((s) => {
      const next = new Set(s);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next.size === 0 ? new Set(calendarFilters) : next;
    });

  const open = (item: CalendarItem) => {
    switch (item.kind) {
      case 'course':
        return router.push({
          pathname: '/courses/[id]',
          params: { id: item.occurrence.seriesId, date: item.occurrence.originalDate },
        });
      case 'exam':
        return router.push({ pathname: '/exams/[id]', params: { id: item.exam.id } });
      case 'work':
        return router.push({
          pathname: '/work/[id]',
          params: { id: item.item.id, kind: item.item.kind },
        });
      case 'event':
        return router.push(eventHref(item.event));
      case 'revision':
        return router.push({ pathname: '/revision/[id]', params: { id: item.block.id } });
      default:
        return undefined;
    }
  };

  const move = async (item: CalendarItem, to: MoveTarget) => {
    if (item.kind === 'event' && isSlotEvent(item.event)) {
      // Séance d'un créneau fixe : elle se change dans « Mon planning » (toutes les semaines).
      showInfo(t('planning.slotMoveTitle'), t('planning.slotMoveMessage'));
      return;
    }
    if (item.kind === 'course') {
      // Un cours revient chaque semaine : on précise que seule cette séance bouge.
      const ok = await confirmAction(
        t('calendar.moveCourseTitle'),
        t('calendar.moveCourseMessage', {
          date: formatShortDate(to.date, labels.lang),
          time: to.startTime,
        }),
        t('calendar.moveConfirm'),
      );
      if (!ok) return;
    }
    await moveCalendarItem(db, item, to).catch((e: unknown) => showError(userMessageKey(e)));
  };

  const step = (dir: 1 | -1) => {
    if (mode === 'month') {
      const d = fromIsoDate(selected);
      d.setDate(1);
      d.setMonth(d.getMonth() + dir);
      setSelected(toIsoDate(d));
    } else setSelected(addDaysIso(selected, dir * 7));
  };

  const dayList = (day: IsoDate) => {
    const items = days.get(day) ?? [];
    if (agenda.loading && items.length === 0) return null;
    if (items.length === 0)
      return (
        <EmptyState icon="calendar" title={t('calendar.empty')} message={t('calendar.emptyHint')} />
      );
    return (
      <Card>
        {items.map((item) => (
          <CalendarItemRow key={calendarItemKey(item)} item={item} subjects={byId} now={now} />
        ))}
      </Card>
    );
  };

  const navButton = (icon: 'chevron-left' | 'chevron-right', dir: 1 | -1) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir === -1 ? t('calendar.previous') : t('calendar.next')}
      onPress={() => step(dir)}
      style={{
        width: minTouchSize,
        height: minTouchSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather name={icon} size={24} color={colors.primary} />
    </Pressable>
  );

  return (
    <View style={{ flex: 1 }}>
      <Screen
        title={formatMonthYear(selected, labels.lang)}
        actions={
          <>
            <ExportCalendarButton data={agenda.data} subjects={byId} />
            <SearchButton />
          </>
        }
      >
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Segmented
              value={mode}
              onChange={setMode}
              options={viewModes.map((m) => ({ value: m, label: t(`calendar.${m}`) }))}
            />
          </View>
          {spaces.has('work') || spaces.has('personal') ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('planning.title')}
              onPress={() => router.push('/planning')}
              style={{
                width: minTouchSize,
                height: minTouchSize,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="repeat" size={22} color={colors.primary} />
            </Pressable>
          ) : null}
          {study ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('calendar.timetables')}
              onPress={() => router.push('/timetables')}
              style={{
                width: minTouchSize,
                height: minTouchSize,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Feather name="grid" size={22} color={colors.primary} />
            </Pressable>
          ) : null}
        </View>

        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          {navButton('chevron-left', -1)}
          {selected !== today ? (
            <Pressable accessibilityRole="button" onPress={() => setSelected(today)} hitSlop={10}>
              <AppText variant="bodyStrong" color="primary">
                {t('calendar.goToday')}
              </AppText>
            </Pressable>
          ) : null}
          {navButton('chevron-right', 1)}
        </View>

        <ChoiceChips
          scroll
          options={filterChoices.map((f) => ({ value: f, label: t(`calendar.filter.${f}`) }))}
          selected={[...shown]}
          onToggle={toggleFilter}
        />

        {mode === 'hours' ? null : mode === 'month' ? (
          <MonthGrid
            selected={selected}
            today={today}
            onSelect={setSelected}
            hasItems={(d) => days.get(d)?.some((i) => i.kind !== 'dayOff') ?? false}
            isOff={(d) =>
              days.get(d)?.some((i) => i.kind === 'dayOff' && i.period.suspendCourses) ?? false
            }
          />
        ) : (
          <WeekStrip
            start={weekStart}
            selected={selected}
            today={today}
            onSelect={setSelected}
            hasItems={(d) => days.get(d)?.some((i) => i.kind !== 'dayOff') ?? false}
            isOff={(d) =>
              days.get(d)?.some((i) => i.kind === 'dayOff' && i.period.suspendCourses) ?? false
            }
          />
        )}

        {mode === 'hours' ? (
          <>
            <AppText variant="caption" color="muted">
              {t('calendar.hoursHint')}
            </AppText>
            <WeekHoursGrid
              weekStart={weekStart}
              today={today}
              days={days}
              subjects={byId}
              onOpen={open}
              onMove={(item, to) => void move(item, to)}
            />
          </>
        ) : mode === 'week' ? (
          Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)).map((day) => (
            <View key={day} style={{ gap: spacing.sm }}>
              <SectionHeader title={formatLongDate(fromIsoDate(day), labels.lang)} />
              {(days.get(day)?.length ?? 0) === 0 ? (
                <AppText color="muted">{t('calendar.nothing')}</AppText>
              ) : (
                dayList(day)
              )}
            </View>
          ))
        ) : (
          <>
            <SectionHeader title={formatLongDate(fromIsoDate(selected), labels.lang)} />
            {dayList(selected)}
          </>
        )}
        <View style={{ height: 80 }} />
      </Screen>
      <Fab
        accessibilityLabel={t('add.title')}
        onPress={() => router.push({ pathname: '/add', params: { date: selected } })}
      />
    </View>
  );
}

type DayPickerProps = {
  selected: IsoDate;
  today: IsoDate;
  onSelect: (d: IsoDate) => void;
  hasItems: (d: IsoDate) => boolean;
  isOff: (d: IsoDate) => boolean;
};

function DayCell({
  day,
  selected,
  today,
  onSelect,
  hasItems,
  isOff,
  dimmed,
}: DayPickerProps & { day: IsoDate; dimmed?: boolean }) {
  const labels = useLabels();
  const { colors, radius } = useTheme();
  const isSelected = day === selected;
  const isToday = day === today;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={formatLongDate(fromIsoDate(day), labels.lang)}
      onPress={() => onSelect(day)}
      style={{
        flex: 1,
        minHeight: minTouchSize,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        backgroundColor: isSelected
          ? colors.primary
          : isOff(day)
            ? colors.warningSoft
            : 'transparent',
        borderWidth: isToday && !isSelected ? 1.5 : 0,
        borderColor: colors.primary,
        opacity: dimmed ? 0.45 : 1,
      }}
    >
      <AppText variant="bodyStrong" color={isSelected ? 'onPrimary' : 'text'}>
        {Number(day.slice(8))}
      </AppText>
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: 3,
          backgroundColor: hasItems(day)
            ? isSelected
              ? colors.onPrimary
              : colors.primary
            : 'transparent',
        }}
      />
    </Pressable>
  );
}

function WeekdayHeader() {
  const labels = useLabels();
  const weekStartDay = useWeekStart();
  return (
    <View style={{ flexDirection: 'row' }}>
      {weekdayOrder(weekStartDay).map((n) => (
        <AppText key={n} variant="caption" color="muted" style={{ flex: 1, textAlign: 'center' }}>
          {labels.weekday(n, 'short')}
        </AppText>
      ))}
    </View>
  );
}

function WeekStrip({ start, ...rest }: DayPickerProps & { start: IsoDate }) {
  const { spacing } = useTheme();
  return (
    <Card style={{ padding: spacing.sm, gap: spacing.xs }}>
      <WeekdayHeader />
      <View style={{ flexDirection: 'row', gap: 2 }}>
        {Array.from({ length: 7 }, (_, i) => addDaysIso(start, i)).map((day) => (
          <DayCell key={day} day={day} {...rest} />
        ))}
      </View>
    </Card>
  );
}

function MonthGrid(props: DayPickerProps) {
  const { spacing } = useTheme();
  const weekStartDay = useWeekStart();
  const grid = monthGrid(props.selected, weekStartDay);
  const month = props.selected.slice(0, 7);
  return (
    <Card style={{ padding: spacing.sm, gap: spacing.xs }}>
      <WeekdayHeader />
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <View key={row} style={{ flexDirection: 'row', gap: 2 }}>
          {grid.slice(row * 7, row * 7 + 7).map((day) => (
            <DayCell key={day} day={day} {...props} dimmed={day.slice(0, 7) !== month} />
          ))}
        </View>
      ))}
    </Card>
  );
}
