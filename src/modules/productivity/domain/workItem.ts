import { z } from 'zod';

import { atTime, type IsoDate } from '@/shared/dates';
import { isoDate, optionalId, optionalText, optionalTime, requiredText } from '@/shared/validation';

/** Une tâche (académique ou perso) et un devoir ont la même forme mais restent des entités séparées. */
export const workKinds = ['task', 'assignment'] as const;
export type WorkKind = (typeof workKinds)[number];

export const priorities = ['low', 'normal', 'important', 'urgent'] as const;
export type Priority = (typeof priorities)[number];

export const workStatuses = ['todo', 'in_progress', 'done'] as const;
export type WorkStatus = (typeof workStatuses)[number];

export const workItemInputSchema = z.object({
  title: requiredText(120),
  description: optionalText(2000),
  subjectId: optionalId,
  dueDate: isoDate,
  dueTime: optionalTime,
  priority: z.enum(priorities),
  status: z.enum(workStatuses),
});

export type WorkItemInput = z.input<typeof workItemInputSchema>;
export type WorkItem = z.output<typeof workItemInputSchema> & {
  id: string;
  kind: WorkKind;
  completedAt: string | null;
};

/** Moment où l'élément devient « en retard » : l'heure limite, sinon la fin de la journée. */
export function dueMoment(item: Pick<WorkItem, 'dueDate' | 'dueTime'>): Date {
  return item.dueTime ? atTime(item.dueDate, item.dueTime) : atTime(item.dueDate, '23:59');
}

/**
 * « En retard » est calculé, jamais enregistré : le statut reste celui choisi par l'étudiant
 * (spécification §57).
 */
export function isOverdue(
  item: Pick<WorkItem, 'dueDate' | 'dueTime' | 'status'>,
  now: Date,
): boolean {
  return item.status !== 'done' && dueMoment(item).getTime() < now.getTime();
}

export function isDueOn(item: Pick<WorkItem, 'dueDate'>, day: IsoDate): boolean {
  return item.dueDate === day;
}

const priorityRank: Record<Priority, number> = { urgent: 0, important: 1, normal: 2, low: 3 };

/** Tri : date limite, puis priorité (urgent d'abord), puis titre. */
export function compareWorkItems(a: WorkItem, b: WorkItem): number {
  return (
    dueMoment(a).getTime() - dueMoment(b).getTime() ||
    priorityRank[a.priority] - priorityRank[b.priority] ||
    a.title.localeCompare(b.title)
  );
}
