import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useLabels } from '@/hooks/useLabels';
import { colorOf, type Subject } from '@/modules/academic';
import {
  layoutDay,
  moveTarget,
  visibleHours,
  type CalendarItem,
  type MoveTarget,
  type TimedBlock,
} from '@/projections';
import { addDaysIso, isoWeekday, minutesToTime, type IsoDate } from '@/shared/dates';
import { useTheme } from '@/shared/theme';
import { AppText } from '@/shared/ui';

const HOUR_HEIGHT = 52;
const GUTTER = 36;

type Props = {
  weekStart: IsoDate;
  today: IsoDate;
  days: ReadonlyMap<IsoDate, CalendarItem[]>;
  subjects: ReadonlyMap<string, Subject>;
  onOpen: (item: CalendarItem) => void;
  onMove: (item: CalendarItem, to: MoveTarget) => void;
};

function itemTitle(
  item: CalendarItem,
  subjects: ReadonlyMap<string, Subject>,
  fallback: (k: string) => string,
) {
  switch (item.kind) {
    case 'course':
      return item.occurrence.title ?? subjects.get(item.occurrence.subjectId)?.name ?? '';
    case 'exam':
      return subjects.get(item.exam.subjectId)?.name ?? fallback('exam');
    case 'work':
      return item.item.title;
    case 'event':
      return item.event.title;
    case 'revision':
      return (
        item.block.title ??
        (item.block.subjectId ? subjects.get(item.block.subjectId)?.name : null) ??
        fallback('revision')
      );
    case 'dayOff':
      return item.period.name;
  }
}

function subjectIdOf(item: CalendarItem): string | null {
  switch (item.kind) {
    case 'course':
      return item.occurrence.subjectId;
    case 'exam':
      return item.exam.subjectId;
    case 'work':
      return item.item.subjectId;
    case 'revision':
      return item.block.subjectId;
    default:
      return null;
  }
}

/**
 * Semaine en colonnes, heures en lignes. Appui long sur un cours, une tâche, une révision ou un
 * événement puis glisser : il change de jour / d'heure (au quart d'heure). Un appui court l'ouvre.
 */
export function WeekHoursGrid({ weekStart, today, days, subjects, onOpen, onMove }: Props) {
  const { t } = useTranslation();
  const labels = useLabels();
  const { colors, spacing, radius, scheme } = useTheme();
  const [width, setWidth] = useState(0);
  const dates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i)),
    [weekStart],
  );
  const layouts = useMemo(
    () => dates.map((d) => ({ day: d, ...layoutDay(days.get(d) ?? []) })),
    [dates, days],
  );
  const hours = visibleHours(layouts.flatMap((l) => l.timed));
  const colWidth = width > 0 ? (width - GUTTER) / 7 : 0;
  const height = (hours.to - hours.from) * HOUR_HEIGHT;
  const hasUntimed = layouts.some((l) => l.untimed.length > 0);
  const title = (item: CalendarItem) => itemTitle(item, subjects, (k) => t(`calendarItem.${k}`));

  const tone = (item: CalendarItem) => {
    if (item.kind === 'exam') return { bg: colors.dangerSoft, fg: colors.danger };
    if (item.kind === 'event') return { bg: colors.warningSoft, fg: colors.warning };
    const id = subjectIdOf(item);
    const c = colorOf(id ? subjects.get(id) : undefined);
    return scheme === 'dark' ? { bg: c.softDark, fg: c.strongDark } : { bg: c.soft, fg: c.strong };
  };

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', paddingLeft: GUTTER }}>
        {dates.map((d) => (
          <View key={d} style={{ flex: 1, alignItems: 'center' }}>
            <AppText variant="caption" color={d === today ? 'primary' : 'muted'}>
              {labels.weekday(isoWeekday(d), 'short')}
            </AppText>
            <AppText variant="bodyStrong" color={d === today ? 'primary' : 'text'}>
              {Number(d.slice(8))}
            </AppText>
          </View>
        ))}
      </View>

      {hasUntimed ? (
        <View style={{ flexDirection: 'row', paddingLeft: GUTTER, gap: 2 }}>
          {layouts.map((l) => (
            <View key={l.day} style={{ flex: 1, gap: 2 }}>
              {l.untimed.map((item, i) => (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={title(item)}
                  onPress={() => onOpen(item)}
                  style={{
                    backgroundColor: tone(item).bg,
                    borderRadius: 6,
                    paddingHorizontal: 3,
                    paddingVertical: 2,
                  }}
                >
                  <AppText variant="label" numberOfLines={1} style={{ color: tone(item).fg }}>
                    {title(item)}
                  </AppText>
                </Pressable>
              ))}
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ height, flexDirection: 'row' }}>
        <View style={{ width: GUTTER }}>
          {Array.from({ length: hours.to - hours.from }, (_, i) => (
            <AppText
              key={i}
              variant="label"
              color="muted"
              style={{ position: 'absolute', top: i * HOUR_HEIGHT - 6, right: 6 }}
            >
              {`${hours.from + i}h`}
            </AppText>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          {Array.from({ length: hours.to - hours.from + 1 }, (_, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                top: i * HOUR_HEIGHT,
                left: 0,
                right: 0,
                height: 1,
                backgroundColor: colors.border,
              }}
            />
          ))}
          {dates.map((d, col) =>
            d === today ? (
              <View
                key={d}
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: col * colWidth,
                  width: colWidth,
                  backgroundColor: colors.primarySoft,
                  opacity: 0.4,
                  borderRadius: radius.sm,
                }}
              />
            ) : null,
          )}
          {colWidth > 0
            ? layouts.flatMap((l, col) =>
                l.timed.map((b, i) => (
                  <Block
                    key={`${l.day}-${i}`}
                    block={b}
                    day={l.day}
                    left={col * colWidth + (b.lane * colWidth) / b.lanes}
                    width={colWidth / b.lanes - 2}
                    top={((b.start - hours.from * 60) / 60) * HOUR_HEIGHT}
                    height={Math.max(18, ((b.end - b.start) / 60) * HOUR_HEIGHT - 2)}
                    colWidth={colWidth}
                    title={title(b.item)}
                    tone={tone(b.item)}
                    struck={
                      (b.item.kind === 'course' && b.item.occurrence.status === 'cancelled') ||
                      (b.item.kind === 'revision' && b.item.block.status === 'skipped')
                    }
                    moveHint={t('calendar.moveHint')}
                    onOpen={onOpen}
                    onMove={onMove}
                  />
                )),
              )
            : null}
        </View>
      </View>
    </View>
  );
}

type BlockProps = {
  block: TimedBlock;
  day: IsoDate;
  left: number;
  width: number;
  top: number;
  height: number;
  colWidth: number;
  title: string;
  tone: { bg: string; fg: string };
  struck: boolean;
  moveHint: string;
  onOpen: (item: CalendarItem) => void;
  onMove: (item: CalendarItem, to: MoveTarget) => void;
};

function Block(p: BlockProps) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const lifted = useSharedValue(0);
  const [label, setLabel] = useState<string | null>(null);

  const drop = (dx: number, dy: number) => {
    setLabel(null);
    const dayDelta = Math.round(dx / p.colWidth);
    const minuteDelta = (dy / HOUR_HEIGHT) * 60;
    const to = moveTarget(p.block, p.day, dayDelta, minuteDelta);
    const same = dayDelta === 0 && to.startTime === minutesToTime(p.block.start);
    if (!same) p.onMove(p.block.item, to);
  };
  const preview = (dy: number) => {
    setLabel(moveTarget(p.block, p.day, 0, (dy / HOUR_HEIGHT) * 60).startTime);
  };

  const pan = Gesture.Pan()
    .enabled(p.block.movable)
    .activateAfterLongPress(350)
    .onStart(() => {
      'worklet';
      lifted.value = withSpring(1);
    })
    .onUpdate((e) => {
      'worklet';
      tx.value = e.translationX;
      ty.value = e.translationY;
      scheduleOnRN(preview, e.translationY);
    })
    .onEnd((e) => {
      'worklet';
      scheduleOnRN(drop, e.translationX, e.translationY);
    })
    .onFinalize(() => {
      'worklet';
      tx.value = withSpring(0);
      ty.value = withSpring(0);
      lifted.value = withSpring(0);
    });
  const tap = Gesture.Tap().onEnd(() => {
    'worklet';
    scheduleOnRN(p.onOpen, p.block.item);
  });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: 1 + lifted.value * 0.04 },
    ],
    zIndex: lifted.value > 0 ? 10 : 1,
    opacity: 1 - lifted.value * 0.1,
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={p.title}
        accessibilityHint={p.block.movable ? p.moveHint : undefined}
        style={[
          {
            position: 'absolute',
            left: p.left + 1,
            top: p.top + 1,
            width: p.width,
            height: p.height,
            backgroundColor: p.tone.bg,
            borderLeftWidth: 3,
            borderLeftColor: p.tone.fg,
            borderRadius: 6,
            paddingHorizontal: 3,
            paddingVertical: 1,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <AppText
          variant="label"
          numberOfLines={p.height > 40 ? 3 : 1}
          style={[{ color: p.tone.fg }, p.struck ? { textDecorationLine: 'line-through' } : null]}
        >
          {label ?? p.title}
        </AppText>
      </Animated.View>
    </GestureDetector>
  );
}
