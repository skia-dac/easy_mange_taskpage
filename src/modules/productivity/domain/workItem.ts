import { z } from 'zod';

import { addDaysIso, atTime, fromIsoDate, toIsoDate, type IsoDate } from '@/shared/dates';
import { isoDate, optionalId, optionalText, optionalTime, requiredText } from '@/shared/validation';

/** Une tâche (académique ou perso) et un devoir ont la même forme mais restent des entités séparées. */
export const workKinds = ['task', 'assignment'] as const;
export type WorkKind = (typeof workKinds)[number];

export const priorities = ['low', 'normal', 'important', 'urgent'] as const;
export type Priority = (typeof priorities)[number];

export const workStatuses = ['todo', 'in_progress', 'done'] as const;
export type WorkStatus = (typeof workStatuses)[number];

/** Répétition d'une tâche : quand elle est terminée, la suivante est créée automatiquement. */
export const repeatRules = ['none', 'daily', 'weekly', 'monthly'] as const;
export type RepeatRule = (typeof repeatRules)[number];

export const workItemInputSchema = z.object({
  title: requiredText(120),
  description: optionalText(2000),
  subjectId: optionalId,
  dueDate: isoDate,
  dueTime: optionalTime,
  priority: z.enum(priorities),
  status: z.enum(workStatuses),
  /** Date et heure du rappel (ISO), null = aucun (§73, §75). */
  reminderAt: z.iso
    .datetime({ offset: true })
    .nullish()
    .transform((v) => v ?? null),
  repeat: z.enum(repeatRules).default('none'),
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

/** Prochaine échéance d'une tâche répétée (le 31 → le dernier jour du mois suivant). */
export function nextDueDate(date: IsoDate, rule: RepeatRule): IsoDate | null {
  switch (rule) {
    case 'none':
      return null;
    case 'daily':
      return addDaysIso(date, 1);
    case 'weekly':
      return addDaysIso(date, 7);
    case 'monthly': {
      const d = fromIsoDate(date);
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, last));
      return toIsoDate(d);
    }
  }
}

/** La tâche suivante d'une tâche répétée : même contenu, échéance et rappel décalés, à faire. */
export function nextOccurrenceInput(item: WorkItem): WorkItemInput | null {
  const dueDate = nextDueDate(item.dueDate, item.repeat);
  if (!dueDate) return null;
  const shift = fromIsoDate(dueDate).getTime() - fromIsoDate(item.dueDate).getTime();
  return {
    title: item.title,
    description: item.description,
    subjectId: item.subjectId,
    dueDate,
    dueTime: item.dueTime,
    priority: item.priority,
    status: 'todo',
    reminderAt: item.reminderAt
      ? new Date(new Date(item.reminderAt).getTime() + shift).toISOString()
      : null,
    repeat: item.repeat,
  };
}
