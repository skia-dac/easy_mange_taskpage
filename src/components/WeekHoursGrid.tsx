import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useLabels } from '@/hooks/useLabels';
import { colorOf, type Subject } from '@/modules/academic';
import {
  layoutDay,
  moveTarget,
  SNAP_MINUTES,
  visibleHours,
  type CalendarItem,
  type MoveTarget,
  type TimedBlock,
} from '@/projections';
import { addDaysIso, isoWeekday, minutesToTime, type IsoDate } from '@/shared/dates';
import { minTouchSize, useTheme } from '@/shared/theme';
import { AppText, Tappable } from '@/shared/ui';

import { calendarItemKey } from './CalendarItemRow';

const HOUR_HEIGHT = 52;
const GUTTER = 36;
/** Après un déplacement, le bloc attend la nouvelle position au plus ce temps, puis revient. */
export const DROP_FALLBACK_MS = 1500;

/**
 * Marge de toucher autour d'un bloc pour atteindre 44 pt sans changer l'échelle des heures :
 * en hauteur toujours ; en largeur seulement s'il est seul sur sa colonne (une voisine sinon
 * perdrait une partie de sa surface).
 */
export function blockHitSlop(width: number, height: number, alone: boolean) {
  const v = Math.max(0, Math.ceil((minTouchSize - height) / 2));
  const h = alone ? Math.max(0, Math.ceil((minTouchSize - width) / 2)) : 0;
  return { top: v, bottom: v, left: h, right: h };
}

/** Clés stables (l'élément, pas sa place) : un bloc déplacé garde son composant. */
export function blockKeys(items: readonly CalendarItem[]): string[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = calendarItemKey(item);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return n === 0 ? base : `${base}#${n}`;
  });
}

type Props = {
  weekStart: IsoDate;
  today: IsoDate;
  days: ReadonlyMap<IsoDate, CalendarItem[]>;
  subjects: ReadonlyMap<string, Subject>;
  onOpen: (item: CalendarItem) => void;
  /**
   * Déplacer un élément. Résout `false` si rien n'a bougé (annulé, refusé) : le bloc revient
   * aussitôt. Sinon il reste où on l'a posé jusqu'à ce que les données arrivent.
   */
  onMove: (item: CalendarItem, to: MoveTarget) => Promise<boolean> | void;
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
  // Clés par élément (et non par rang) : un bloc qui change de jour ou d'heure reste le même.
  const timed = useMemo(() => {
    const flat = layouts.flatMap((l, col) => l.timed.map((b) => ({ b, day: l.day, col })));
    const keys = blockKeys(flat.map((x) => x.b.item));
    return flat.map((x, i) => ({ ...x, key: keys[i] as string }));
  }, [layouts]);
  // Hauteur réelle (échelle des heures), 18 pt au moins pour lire le titre.
  const blockHeight = (b: TimedBlock) => Math.max(18, ((b.end - b.start) / 60) * HOUR_HEIGHT - 2);
  const title = (item: CalendarItem) => itemTitle(item, subjects, (k) => t(`calendarItem.${k}`));

  const tone = (item: CalendarItem) => {
    if (item.kind === 'exam') return { bg: colors.dangerSoft, fg: colors.danger };
    if (item.kind === 'event') return { bg: colors.warningSoft, fg: colors.warning };
    const id = subjectIdOf(item);
    const c = colorOf(id ? subjects.get(id) : undefined);
    return scheme === 'dark' ? { bg: c.softDark, fg: c.strongDark } : { bg: c.soft, fg: c.strong };
  };

  return (
    <View
      testID="hours-grid"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ gap: spacing.sm }}
    >
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
        <View style={{ flexDirection: 'row', paddingLeft: GUTTER, gap: spacing.xxs }}>
          {layouts.map((l) => (
            <View key={l.day} style={{ flex: 1, gap: spacing.xxs }}>
              {l.untimed.map((item, i) => (
                <Tappable
                  key={blockKeys(l.untimed)[i]}
                  accessibilityRole="button"
                  accessibilityLabel={title(item)}
                  onPress={() => onOpen(item)}
                  style={{
                    backgroundColor: tone(item).bg,
                    borderRadius: 6,
                    paddingHorizontal: 3,
                    paddingVertical: 2,
                    // Toute la journée : la rangée n'a pas d'échelle, la pastille a sa vraie taille.
                    minHeight: minTouchSize,
                    justifyContent: 'center',
                  }}
                >
                  <AppText variant="caption" numberOfLines={1} style={{ color: tone(item).fg }}>
                    {title(item)}
                  </AppText>
                </Tappable>
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
              {t('calendar.hourMark', { hour: hours.from + i })}
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
            ? timed.map(({ b, day, col, key }) => (
                <Block
                  key={key}
                  block={b}
                  day={day}
                  left={col * colWidth + (b.lane * colWidth) / b.lanes}
                  width={colWidth / b.lanes - 2}
                  top={((b.start - hours.from * 60) / 60) * HOUR_HEIGHT}
                  height={blockHeight(b)}
                  hitSlop={blockHitSlop(colWidth / b.lanes - 2, blockHeight(b), b.lanes === 1)}
                  gestureId={`block-${key}`}
                  colWidth={colWidth}
                  title={title(b.item)}
                  accessibilityLabel={[
                    title(b.item),
                    `${labels.weekday(isoWeekday(day))} ${Number(day.slice(8))}`,
                    `${minutesToTime(b.start)} – ${minutesToTime(b.end)}`,
                    b.item.kind === 'course' && b.item.occurrence.status === 'cancelled'
                      ? t('occurrence.cancelled')
                      : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  tone={tone(b.item)}
                  struck={
                    (b.item.kind === 'course' && b.item.occurrence.status === 'cancelled') ||
                    (b.item.kind === 'revision' && b.item.block.status === 'skipped')
                  }
                  moveHint={t('calendar.moveHint')}
                  onOpen={onOpen}
                  onMove={onMove}
                />
              ))
            : null}
        </View>
      </View>
    </View>
  );
}

/** Noms des actions du lecteur d'écran sur un bloc (exportés pour les tests). */
export const BLOCK_ACTIONS = {
  open: 'activate',
  earlier: 'moveEarlier',
  later: 'moveLater',
  previousDay: 'movePreviousDay',
  nextDay: 'moveNextDay',
} as const;

/**
 * Déplacement demandé par une action du lecteur d'écran (sans geste) : même calcul que le
 * glisser, d'un quart d'heure ou d'un jour. `null` si l'action n'en est pas une, ou si le bloc
 * est déjà au bord de la journée.
 */
export function accessibleMove(
  block: Pick<TimedBlock, 'start' | 'end'>,
  day: IsoDate,
  action: string,
): MoveTarget | null {
  const steps: Record<string, [number, number]> = {
    [BLOCK_ACTIONS.earlier]: [0, -SNAP_MINUTES],
    [BLOCK_ACTIONS.later]: [0, SNAP_MINUTES],
    [BLOCK_ACTIONS.previousDay]: [-1, 0],
    [BLOCK_ACTIONS.nextDay]: [1, 0],
  };
  const step = steps[action];
  if (!step) return null;
  const to = moveTarget(block, day, step[0], step[1]);
  if (to.date === day && to.startTime === minutesToTime(block.start)) return null;
  return to;
}

type BlockProps = {
  block: TimedBlock;
  day: IsoDate;
  left: number;
  width: number;
  top: number;
  height: number;
  /** Zone de toucher autour du bloc (44 pt au moins, voir `blockHitSlop`). */
  hitSlop: { top: number; bottom: number; left: number; right: number };
  /** Identifiant des gestes du bloc (tests). */
  gestureId: string;
  colWidth: number;
  title: string;
  /** Ce que lit le lecteur d'écran : titre, jour, heures, état. */
  accessibilityLabel: string;
  tone: { bg: string; fg: string };
  struck: boolean;
  moveHint: string;
  onOpen: (item: CalendarItem) => void;
  onMove: (item: CalendarItem, to: MoveTarget) => Promise<boolean> | void;
};

/**
 * Décalage du bloc pendant et après le glisser. Posé ailleurs, le bloc reste à l'endroit du
 * lâcher (décalage optimiste) jusqu'à ce que sa nouvelle place (`placed`) arrive des données :
 * le décalage s'efface alors d'un coup, le bloc y est déjà. Sinon (refus, échec, rien reçu à
 * temps) il revient à sa place.
 */
function useDropOffset(placed: string) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settle = useCallback(
    (animate: boolean) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      tx.set(animate ? withSpring(0) : 0);
      ty.set(animate ? withSpring(0) : 0);
    },
    [tx, ty],
  );
  /** Attendre la nouvelle place, avec un filet de sécurité. */
  const hold = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => settle(true), DROP_FALLBACK_MS);
  }, [settle]);
  const last = useRef(placed);
  useEffect(() => {
    if (last.current === placed) return;
    last.current = placed;
    if (timer.current) settle(false);
  }, [placed, settle]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return { tx, ty, settle, hold };
}

function Block(p: BlockProps) {
  const lifted = useSharedValue(0);
  /** Le geste s'est terminé par un lâcher : le décalage reste (voir `drop`). */
  const dropped = useSharedValue(0);
  // Dernier pas d'un quart d'heure montré : l'heure affichée ne change (et React ne refait un
  // rendu) que quand ce pas change, pas à chaque image du glisser.
  const shownStep = useSharedValue(Number.NaN);
  const [label, setLabel] = useState<string | null>(null);
  const { text } = useTheme();
  const { t } = useTranslation();
  // Le glisser est inaccessible au lecteur d'écran (VoiceOver, TalkBack) : les mêmes
  // déplacements sont proposés en actions, et le double-tap ouvre l'élément.
  const actions = [
    { name: BLOCK_ACTIONS.open, label: t('calendar.open') },
    ...(p.block.movable
      ? [
          { name: BLOCK_ACTIONS.earlier, label: t('calendar.moveEarlier') },
          { name: BLOCK_ACTIONS.later, label: t('calendar.moveLater') },
          { name: BLOCK_ACTIONS.previousDay, label: t('calendar.movePreviousDay') },
          { name: BLOCK_ACTIONS.nextDay, label: t('calendar.moveNextDay') },
        ]
      : []),
  ];
  const onAction = (name: string) => {
    if (name === BLOCK_ACTIONS.open) {
      p.onOpen(p.block.item);
      return;
    }
    if (!p.block.movable) return;
    const to = accessibleMove(p.block, p.day, name);
    if (to) p.onMove(p.block.item, to);
  };

  const placed = `${p.day}|${p.top}|${p.left}`;
  const { tx, ty, settle, hold } = useDropOffset(placed);

  const drop = (dx: number, dy: number) => {
    setLabel(null);
    const dayDelta = Math.round(dx / p.colWidth);
    const minuteDelta = (dy / HOUR_HEIGHT) * 60;
    const to = moveTarget(p.block, p.day, dayDelta, minuteDelta);
    const same = dayDelta === 0 && to.startTime === minutesToTime(p.block.start);
    if (same) {
      settle(true);
      return;
    }
    hold();
    void Promise.resolve(p.onMove(p.block.item, to)).then(
      (moved) => {
        if (moved === false) settle(true);
      },
      () => settle(true),
    );
  };
  const preview = (minuteDelta: number) => {
    setLabel(moveTarget(p.block, p.day, 0, minuteDelta).startTime);
  };

  const pan = Gesture.Pan()
    .withTestId(`${p.gestureId}-drag`)
    .hitSlop(p.hitSlop)
    .enabled(p.block.movable)
    .activateAfterLongPress(350)
    .onStart(() => {
      'worklet';
      lifted.set(withSpring(1));
    })
    .onUpdate((e) => {
      'worklet';
      tx.set(e.translationX);
      ty.set(e.translationY);
      const step = Math.round(((e.translationY / HOUR_HEIGHT) * 60) / SNAP_MINUTES);
      if (step !== shownStep.get()) {
        shownStep.set(step);
        scheduleOnRN(preview, step * SNAP_MINUTES);
      }
    })
    .onEnd((e, success) => {
      'worklet';
      if (!success) return;
      dropped.set(1);
      // Le bloc se cale sur la case visée (jour, quart d'heure) et y reste.
      const days = Math.round(e.translationX / p.colWidth);
      const minutes =
        Math.round(((e.translationY / HOUR_HEIGHT) * 60) / SNAP_MINUTES) * SNAP_MINUTES;
      tx.set(withSpring(days * p.colWidth));
      ty.set(withSpring((minutes / 60) * HOUR_HEIGHT));
      scheduleOnRN(drop, e.translationX, e.translationY);
    })
    .onFinalize(() => {
      'worklet';
      shownStep.set(Number.NaN);
      lifted.set(withSpring(0));
      if (dropped.get() === 1) {
        dropped.set(0);
        return;
      }
      tx.set(withSpring(0));
      ty.set(withSpring(0));
    });
  const tap = Gesture.Tap()
    .withTestId(`${p.gestureId}-tap`)
    .hitSlop(p.hitSlop)
    .onEnd(() => {
      'worklet';
      scheduleOnRN(p.onOpen, p.block.item);
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.get() },
      { translateY: ty.get() },
      { scale: 1 + lifted.get() * 0.04 },
    ],
    zIndex: lifted.get() > 0 ? 10 : 1,
    opacity: 1 - lifted.get() * 0.1,
  }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={p.accessibilityLabel}
        accessibilityHint={p.block.movable ? p.moveHint : undefined}
        accessibilityActions={actions}
        onAccessibilityAction={(e) => onAction(e.nativeEvent.actionName)}
        onAccessibilityTap={() => p.onOpen(p.block.item)}
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
          variant="caption"
          numberOfLines={Math.max(1, Math.floor((p.height - 2) / text.caption.lineHeight))}
          style={[{ color: p.tone.fg }, p.struck ? { textDecorationLine: 'line-through' } : null]}
        >
          {label ?? p.title}
        </AppText>
      </Animated.View>
    </GestureDetector>
  );
}
