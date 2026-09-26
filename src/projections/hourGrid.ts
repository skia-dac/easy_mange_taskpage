import { addDaysIso, minutesToTime, timeToMinutes, type IsoDate } from '@/shared/dates';

import type { CalendarItem } from './calendar';

/** Types affichés dans le calendrier, pour les filtres. */
export const calendarFilters = ['course', 'exam', 'work', 'revision', 'event'] as const;
export type CalendarFilter = (typeof calendarFilters)[number];

export function filterItems(
  items: readonly CalendarItem[],
  shown: ReadonlySet<CalendarFilter>,
): CalendarItem[] {
  return items.filter((i) => i.kind === 'dayOff' || shown.has(i.kind));
}

export type TimedBlock = {
  item: CalendarItem;
  /** Minutes depuis minuit. */
  start: number;
  end: number;
  /** Colonne dans le jour quand des éléments se chevauchent (0…lanes-1). */
  lane: number;
  lanes: number;
  /** Peut être déplacé en le faisant glisser. */
  movable: boolean;
};

/** Durée affichée d'une tâche avec heure limite, sans durée estimée. */
const DEFAULT_WORK_MINUTES = 30;
const DEFAULT_MINUTES = 60;
export const SNAP_MINUTES = 15;

/** Début et fin d'un élément dans la journée, ou null s'il n'a pas d'heure. */
export function itemSpan(item: CalendarItem): { start: number; end: number } | null {
  const span = (start: string | null, end: string | null, fallback: number) => {
    if (!start) return null;
    const s = timeToMinutes(start);
    const e = end ? timeToMinutes(end) : s + fallback;
    return { start: s, end: Math.min(24 * 60, Math.max(e, s + SNAP_MINUTES)) };
  };
  switch (item.kind) {
    case 'course':
      return span(item.occurrence.startTime, item.occurrence.endTime, DEFAULT_MINUTES);
    case 'revision':
      return span(item.block.startTime, item.block.endTime, DEFAULT_MINUTES);
    case 'event':
      return span(item.event.startTime, item.event.endTime, DEFAULT_MINUTES);
    case 'exam':
      return span(item.exam.time, null, item.exam.durationMinutes ?? DEFAULT_MINUTES * 2);
    case 'work': {
      // Une tâche s'affiche AVANT son heure limite, sur sa durée estimée.
      if (!item.item.dueTime) return null;
      const end = timeToMinutes(item.item.dueTime);
      const minutes = item.item.estimatedMinutes ?? DEFAULT_WORK_MINUTES;
      return { start: Math.max(0, end - minutes), end: Math.max(end, SNAP_MINUTES) };
    }
    case 'dayOff':
      return null;
  }
}

function isMovable(item: CalendarItem): boolean {
  switch (item.kind) {
    case 'course':
      return item.occurrence.status !== 'cancelled';
    case 'revision':
    case 'event':
      return true;
    case 'work':
      return item.item.status !== 'done';
    default:
      return false;
  }
}

/**
 * Place les éléments d'un jour sur la grille horaire : les éléments qui se chevauchent sont mis
 * côte à côte. Les éléments sans heure sont renvoyés à part (ligne « toute la journée »).
 */
export function layoutDay(items: readonly CalendarItem[]): {
  timed: TimedBlock[];
  untimed: CalendarItem[];
} {
  const untimed: CalendarItem[] = [];
  const spans: { item: CalendarItem; start: number; end: number }[] = [];
  for (const item of items) {
    if (item.kind === 'dayOff') continue;
    const s = itemSpan(item);
    if (s) spans.push({ item, ...s });
    else untimed.push(item);
  }
  spans.sort((a, b) => a.start - b.start || b.end - a.end);

  const timed: TimedBlock[] = [];
  // Groupes d'éléments qui se chevauchent, puis une colonne libre pour chacun.
  let group: TimedBlock[] = [];
  let groupEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...group.map((b) => b.lane + 1));
    for (const b of group) timed.push({ ...b, lanes });
    group = [];
  };
  for (const s of spans) {
    if (s.start >= groupEnd) {
      flush();
      groupEnd = s.end;
    } else groupEnd = Math.max(groupEnd, s.end);
    const laneEnds = new Map<number, number>();
    for (const b of group) laneEnds.set(b.lane, Math.max(laneEnds.get(b.lane) ?? 0, b.end));
    let lane = 0;
    while ((laneEnds.get(lane) ?? -1) > s.start) lane++;
    group.push({ ...s, lane, lanes: 1, movable: isMovable(s.item) });
  }
  flush();
  return { timed, untimed };
}

/** Heures affichées : 7 h – 22 h au minimum, élargi si un élément déborde. */
export function visibleHours(blocks: readonly TimedBlock[]): { from: number; to: number } {
  let from = 7;
  let to = 22;
  for (const b of blocks) {
    from = Math.min(from, Math.floor(b.start / 60));
    to = Math.max(to, Math.ceil(b.end / 60));
  }
  return { from, to: Math.min(24, to) };
}

export type MoveTarget = { date: IsoDate; startTime: string; endTime: string };

/**
 * Nouvelle place d'un élément déplacé de `dayDelta` jours et `minuteDelta` minutes
 * (arrondi au quart d'heure), même durée, sans sortir de la journée.
 */
export function moveTarget(
  block: Pick<TimedBlock, 'start' | 'end'>,
  day: IsoDate,
  dayDelta: number,
  minuteDelta: number,
): MoveTarget {
  const length = block.end - block.start;
  const snapped = Math.round(minuteDelta / SNAP_MINUTES) * SNAP_MINUTES;
  const start = Math.min(24 * 60 - length, Math.max(0, block.start + snapped));
  const end = Math.min(23 * 60 + 59, start + length);
  return {
    date: addDaysIso(day, dayDelta),
    startTime: minutesToTime(start),
    endTime: minutesToTime(end),
  };
}
