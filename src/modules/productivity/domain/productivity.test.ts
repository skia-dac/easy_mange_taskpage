import { parseInput, ValidationError } from '@/shared/validation';

import { personalEventInputSchema } from './personalEvent';
import { compareWorkItems, isOverdue, type WorkItem } from './workItem';

const item = (over: Partial<WorkItem> = {}): WorkItem => ({
  id: 'w',
  kind: 'assignment',
  title: 'Étude de cas',
  description: null,
  subjectId: null,
  dueDate: '2026-09-23',
  dueTime: null,
  priority: 'normal',
  status: 'todo',
  completedAt: null,
  ...over,
});

describe('en retard (§57, §63)', () => {
  const now = new Date(2026, 8, 23, 14, 0); // 23 sept. 14:00

  it('sans heure : en retard seulement après la fin de la journée', () => {
    expect(isOverdue(item(), now)).toBe(false);
    expect(isOverdue(item({ dueDate: '2026-09-22' }), now)).toBe(true);
  });

  it('avec heure : en retard dès que l’heure est passée', () => {
    expect(isOverdue(item({ dueTime: '12:00' }), now)).toBe(true);
    expect(isOverdue(item({ dueTime: '18:00' }), now)).toBe(false);
  });

  it('un élément terminé n’est jamais en retard', () => {
    expect(isOverdue(item({ dueDate: '2026-09-01', status: 'done' }), now)).toBe(false);
  });
});

it('trie par échéance puis priorité', () => {
  const a = item({ id: 'a', priority: 'low' });
  const b = item({ id: 'b', priority: 'urgent' });
  const c = item({ id: 'c', dueDate: '2026-09-22' });
  expect([a, b, c].sort(compareWorkItems).map((w) => w.id)).toEqual(['c', 'b', 'a']);
});

describe('événement personnel', () => {
  it('heures facultatives', () => {
    expect(
      parseInput(personalEventInputSchema, { title: 'Anniversaire', date: '2026-09-25' }),
    ).toMatchObject({
      startTime: null,
      endTime: null,
    });
  });

  it('refuse une fin avant le début', () => {
    expect(() =>
      parseInput(personalEventInputSchema, {
        title: 'Réunion',
        date: '2026-09-25',
        startTime: '19:00',
        endTime: '18:00',
      }),
    ).toThrow(ValidationError);
  });
});
