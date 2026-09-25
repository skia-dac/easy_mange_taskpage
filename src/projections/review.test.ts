import type { WorkItem } from '@/modules/productivity';

import { buildEveningReview } from './review';

const work = (id: string, dueDate: string, over: Partial<WorkItem> = {}): WorkItem => ({
  id,
  kind: 'task',
  title: id,
  description: null,
  subjectId: null,
  dueDate,
  dueTime: null,
  priority: 'normal',
  status: 'todo',
  completedAt: null,
  reminderAt: null,
  repeat: 'none',
  estimatedMinutes: null,
  space: 'personal',
  ...over,
});

describe('bilan du soir', () => {
  it('ce qui reste aujourd’hui, et demain avec le temps de travail prévu', () => {
    const r = buildEveningReview(
      {
        series: [],
        exams: [],
        events: [],
        work: [
          work('retard', '2026-09-20'),
          work('auj', '2026-09-23'),
          work('fait', '2026-09-23', { status: 'done' }),
          work('demain', '2026-09-24', { estimatedMinutes: 45 }),
        ],
        revisionBlocks: [
          {
            id: 'r',
            subjectId: null,
            examId: null,
            timetableId: null,
            date: '2026-09-24',
            startTime: '18:00',
            endTime: '19:30',
            title: null,
            status: 'planned',
            studySessionId: null,
          },
        ],
      },
      new Date(2026, 8, 23, 20, 30),
    );
    expect(r.remaining.map((w) => w.id)).toEqual(['retard', 'auj']);
    expect(r.next.due.map((w) => w.id)).toEqual(['demain']);
    expect(r.next.plannedMinutes).toBe(135);
  });
});
