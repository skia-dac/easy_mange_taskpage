import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { calendarItemKey, CalendarItemRow } from '@/components/CalendarItemRow';
import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import { calendarDays, useAgendaData, type CalendarItem } from '@/projections';
import { addDaysIso, fromIsoDate, startOfIsoWeek, toIsoDate, type IsoDate } from '@/shared/dates';
import { formatLongDate, formatMonthYear } from '@/shared/format';
import { minTouchSize, useTheme } from '@/shared/theme';
import { useNow } from '@/shared/useNow';
import { AppText, Card, EmptyState, Fab, Screen, Segmented, SectionHeader } from '@/shared/ui';

type ViewMode = 'day' | 'week' | 'month';

function monthGrid(anyDay: IsoDate): IsoDate[] {
  const first = `${anyDay.slice(0, 7)}-01`;
  const start = startOfIsoWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDaysIso(start, i));
}

export default function CalendarScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const { colors, spacing } = useTheme();
  const now = useNow(60_000);
  const today = toIsoDate(now);
  const [mode, setMode] = useState<ViewMode>('day');
  const [selected, setSelected] = useState<IsoDate>(today);
  const agenda = useAgendaData();
  const { byId } = useSubjects();

  const weekStart = startOfIsoWeek(selected);
  const range = useMemo(() => {
    if (mode === 'month') {
      const grid = monthGrid(selected);
      return { from: grid[0]!, to: grid[41]! };
    }
    return { from: weekStart, to: addDaysIso(weekStart, 6) };
  }, [mode, selected, weekStart]);

  const days = useMemo(
    () =>
      agenda.data
        ? calendarDays(agenda.data, range.from, range.to)
        : new Map<IsoDate, CalendarItem[]>(),
    [agenda.data, range.from, range.to],
  );

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
      <Screen title={formatMonthYear(selected, labels.lang)}>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: 'day', label: t('calendar.day') },
                { value: 'week', label: t('calendar.week') },
                { value: 'month', label: t('calendar.month') },
              ]}
            />
          </View>
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

        {mode === 'month' ? (
          <MonthGrid
            selected={selected}
            today={today}
            onSelect={setSelected}
            hasItems={(d) => (days.get(d)?.length ?? 0) > 0}
          />
        ) : (
          <WeekStrip
            start={weekStart}
            selected={selected}
            today={today}
            onSelect={setSelected}
            hasItems={(d) => (days.get(d)?.length ?? 0) > 0}
          />
        )}

        {mode === 'week' ? (
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
};

function DayCell({
  day,
  selected,
  today,
  onSelect,
  hasItems,
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
        backgroundColor: isSelected ? colors.primary : 'transparent',
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
  return (
    <View style={{ flexDirection: 'row' }}>
      {[1, 2, 3, 4, 5, 6, 7].map((n) => (
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
  const grid = monthGrid(props.selected);
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
