import { occurrencesInRange } from '@/modules/academic';
import {
  addDaysIso,
  daysBetween,
  minutesToTime,
  timeToMinutes,
  type IsoDate,
} from '@/shared/dates';

import type { TodayData } from './today';

export type RevisionPlanOptions = {
  /** Date de l'examen : aucune séance ce jour-là ni après. */
  examDate: IsoDate;
  /** Aujourd'hui : aucune séance avant. */
  today: IsoDate;
  /** Heure actuelle (« HH:mm ») : aujourd'hui, seulement après. */
  nowTime?: string;
  sessions: number;
  minutes: number;
  /** Nombre de jours avant l'examen où l'on peut réviser. */
  daysBefore: number;
  /** Plage horaire où placer les séances. */
  windowStart: string;
  windowEnd: string;
};

export type ProposedBlock = { date: IsoDate; startTime: string; endTime: string };

export type RevisionPlan = {
  blocks: ProposedBlock[];
  /** Séances qui n'ont pas trouvé de place (plage trop remplie). */
  missing: number;
};

type Busy = { start: number; end: number };

const STEP = 15;
/** Petite marge entre une séance et ce qui l'entoure. */
const GAP = 15;

/** Créneaux déjà pris ce jour-là : cours (non annulés), examens, événements, révisions prévues. */
export function busySlots(data: TodayData, from: IsoDate, to: IsoDate): Map<IsoDate, Busy[]> {
  const out = new Map<IsoDate, Busy[]>();
  const add = (day: IsoDate, start: string | null, end: string | null, fallback = 60) => {
    if (!start || day < from || day > to) return;
    const s = timeToMinutes(start);
    const e = end ? timeToMinutes(end) : s + fallback;
    const list = out.get(day) ?? [];
    list.push({ start: s, end: Math.max(e, s + STEP) });
    out.set(day, list);
  };
  for (const o of occurrencesInRange(data.series, from, to, data)) {
    if (o.status !== 'cancelled') add(o.date, o.startTime, o.endTime);
  }
  for (const e of data.exams) {
    add(
      e.date,
      e.time,
      e.time && e.durationMinutes ? minutesToTime(timeToMinutes(e.time) + e.durationMinutes) : null,
      120,
    );
  }
  for (const ev of data.events) add(ev.date, ev.startTime, ev.endTime);
  for (const b of data.revisionBlocks ?? []) {
    if (b.status !== 'skipped') add(b.date, b.startTime, b.endTime);
  }
  return out;
}

function freeSlot(busy: readonly Busy[], from: number, to: number, minutes: number): number | null {
  for (let start = Math.ceil(from / STEP) * STEP; start + minutes <= to; start += STEP) {
    const end = start + minutes;
    if (busy.every((b) => end + GAP <= b.start || start >= b.end + GAP)) return start;
  }
  return null;
}

/**
 * Répartit `sessions` séances de `minutes` sur les jours qui précèdent l'examen, dans la plage
 * horaire choisie, sans chevaucher cours, examens, événements ni autres révisions.
 * Les séances sont étalées régulièrement, avec la dernière la veille de l'examen ; s'il y a plus de
 * séances que de jours, certains jours en reçoivent deux (ou plus). Rien n'est enregistré :
 * l'écran montre la proposition, l'étudiant la modifie puis la valide.
 */
export function planRevisions(data: TodayData, o: RevisionPlanOptions): RevisionPlan {
  const lastDay = addDaysIso(o.examDate, -1);
  let firstDay = addDaysIso(o.examDate, -Math.max(1, o.daysBefore));
  if (firstDay < o.today) firstDay = o.today;
  const sessions = Math.max(0, Math.floor(o.sessions));
  if (sessions === 0 || firstDay > lastDay) return { blocks: [], missing: sessions };

  const dayCount = daysBetween(firstDay, lastDay) + 1;
  const days = Array.from({ length: dayCount }, (_, i) => addDaysIso(firstDay, i));
  const busy = busySlots(data, firstDay, lastDay);
  const windowStart = timeToMinutes(o.windowStart);
  const windowEnd = timeToMinutes(o.windowEnd);

  // Nombre de séances visé par jour : étalé, en commençant par la fin (veille de l'examen).
  const wanted = new Array<number>(dayCount).fill(0);
  for (let i = 0; i < sessions; i++) {
    const idx = dayCount - 1 - Math.floor((i * dayCount) / sessions);
    wanted[idx] = (wanted[idx] ?? 0) + 1;
  }

  const blocks: ProposedBlock[] = [];
  const place = (index: number): boolean => {
    const day = days[index] as IsoDate;
    const from =
      day === o.today && o.nowTime
        ? Math.max(windowStart, timeToMinutes(o.nowTime) + GAP)
        : windowStart;
    const list = busy.get(day) ?? [];
    const start = freeSlot(list, from, windowEnd, o.minutes);
    if (start === null) return false;
    list.push({ start, end: start + o.minutes });
    busy.set(day, list);
    blocks.push({
      date: day,
      startTime: minutesToTime(start),
      endTime: minutesToTime(start + o.minutes),
    });
    return true;
  };

  let missing = 0;
  for (let i = 0; i < dayCount; i++) {
    for (let n = 0; n < (wanted[i] ?? 0); n++) if (!place(i)) missing++;
  }
  // Séances sans place : on essaie les autres jours, en partant de la fin.
  for (let i = dayCount - 1; i >= 0 && missing > 0; i--) {
    while (missing > 0 && place(i)) missing--;
  }

  blocks.sort((a, b) =>
    a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
  );
  return { blocks, missing };
}

/** Valeurs proposées par défaut selon le temps restant avant l'examen. */
export function defaultPlanOptions(examDate: IsoDate, today: IsoDate) {
  const days = Math.max(1, daysBetween(today, examDate));
  const daysBefore = Math.min(days, 7);
  return {
    sessions: Math.min(daysBefore, 5),
    minutes: 60,
    daysBefore,
    windowStart: '17:00',
    windowEnd: '21:00',
  };
}
