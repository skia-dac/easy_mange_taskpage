import { occurrencesInRange, type Exam, type Occurrence } from '@/modules/academic';
import {
  compareWorkItems,
  type PersonalEvent,
  type RevisionBlock,
  type WorkItem,
} from '@/modules/productivity';
import { addDaysIso, toIsoDate, type IsoDate } from '@/shared/dates';

import type { TodayData } from './today';

export type EveningReview = {
  today: IsoDate;
  tomorrow: IsoDate;
  /** Tâches et devoirs pas terminés, dus aujourd'hui ou en retard : terminer ou reporter. */
  remaining: WorkItem[];
  /** Révisions d'aujourd'hui encore « prévues ». */
  revisions: RevisionBlock[];
  next: {
    courses: Occurrence[];
    due: WorkItem[];
    exams: Exam[];
    events: PersonalEvent[];
    revisions: RevisionBlock[];
    /** Minutes de travail prévues demain (durées estimées + révisions). */
    plannedMinutes: number;
  };
};

/** Bilan du soir : ce qui reste aujourd'hui, et un aperçu de demain (fonction pure). */
export function buildEveningReview(data: TodayData, now: Date): EveningReview {
  const today = toIsoDate(now);
  const tomorrow = addDaysIso(today, 1);
  const open = data.work.filter((w) => w.status !== 'done');
  const blocks = data.revisionBlocks ?? [];
  const due = open.filter((w) => w.dueDate === tomorrow).sort(compareWorkItems);
  const revisionsTomorrow = blocks
    .filter((b) => b.date === tomorrow && b.status === 'planned')
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const minutes = (start: string, end: string) => {
    const [sh, sm] = start.split(':').map(Number) as [number, number];
    const [eh, em] = end.split(':').map(Number) as [number, number];
    return eh * 60 + em - (sh * 60 + sm);
  };
  return {
    today,
    tomorrow,
    remaining: open.filter((w) => w.dueDate <= today).sort(compareWorkItems),
    revisions: blocks.filter((b) => b.date === today && b.status === 'planned'),
    next: {
      courses: occurrencesInRange(data.series, tomorrow, tomorrow, data).filter(
        (o) => o.status !== 'cancelled',
      ),
      due,
      exams: data.exams.filter((e) => e.date === tomorrow),
      events: data.events.filter((e) => e.date === tomorrow),
      revisions: revisionsTomorrow,
      plannedMinutes:
        due.reduce((sum, w) => sum + (w.estimatedMinutes ?? 0), 0) +
        revisionsTomorrow.reduce((sum, b) => sum + minutes(b.startTime, b.endTime), 0),
    },
  };
}
