import type { PersonalEvent } from '../domain/personalEvent';
import type { Priority, WorkItem, WorkKind, WorkStatus } from '../domain/workItem';

export type WorkItemRow = {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  due_date: string;
  due_time: string | null;
  priority: string;
  status: string;
  completed_at: string | null;
  reminder_at: string | null;
};

export const toWorkItem =
  (kind: WorkKind) =>
  (r: WorkItemRow): WorkItem => ({
    id: r.id,
    kind,
    title: r.title,
    description: r.description,
    subjectId: r.subject_id,
    dueDate: r.due_date,
    dueTime: r.due_time,
    priority: r.priority as Priority,
    status: r.status as WorkStatus,
    completedAt: r.completed_at,
    reminderAt: r.reminder_at,
  });

export type PersonalEventRow = {
  id: string;
  title: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  description: string | null;
  reminder_at: string | null;
};

export const toPersonalEvent = (r: PersonalEventRow): PersonalEvent => ({
  id: r.id,
  title: r.title,
  date: r.date,
  startTime: r.start_time,
  endTime: r.end_time,
  description: r.description,
  reminderAt: r.reminder_at,
});

export const tableOf = (kind: WorkKind) => (kind === 'task' ? 'tasks' : 'assignments');
