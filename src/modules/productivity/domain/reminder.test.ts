import { atTime } from '@/shared/dates';
import { parseInput, ValidationError } from '@/shared/validation';

import {
  nextOccurrenceInput,
  shiftReminder,
  workItemInputSchema,
  type WorkItem,
  type WorkItemInput,
} from './workItem';

const base: WorkItemInput = {
  title: 'Exposé',
  dueDate: '2026-10-10',
  priority: 'normal',
  status: 'todo',
};

describe('le rappel suit l’échéance', () => {
  it('« la veille à 18:00 » reste la veille quand la date change', () => {
    const dayBefore = atTime('2026-10-09', '18:00').toISOString();
    expect(shiftReminder(dayBefore, '2026-10-10', '2026-10-15')).toBe(
      atTime('2026-10-14', '18:00').toISOString(),
    );
    // Avancer la date avance aussi le rappel (jamais resté sur l'ancienne date).
    expect(shiftReminder(dayBefore, '2026-10-10', '2026-10-03')).toBe(
      atTime('2026-10-02', '18:00').toISOString(),
    );
    expect(shiftReminder(dayBefore, '2026-10-10', '2026-10-10')).toBe(dayBefore);
    expect(shiftReminder(null, '2026-10-10', '2026-10-15')).toBeNull();
  });

  it('refuse un rappel après l’échéance, avec un message clair', () => {
    const after = atTime('2026-10-11', '09:00').toISOString();
    try {
      parseInput(workItemInputSchema, { ...base, reminderAt: after });
      throw new Error('aurait dû être refusé');
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).fields.reminderAt).toBe('validation.reminderAfterDue');
    }
    // Le jour même à 09:00 avec une heure limite à 08:00 : trop tard aussi.
    expect(() =>
      parseInput(workItemInputSchema, {
        ...base,
        dueTime: '08:00',
        reminderAt: atTime('2026-10-10', '09:00').toISOString(),
      }),
    ).toThrow(ValidationError);
    // Avant l'échéance : accepté (sans heure limite, l'échéance est la fin de la journée).
    expect(
      parseInput(workItemInputSchema, {
        ...base,
        reminderAt: atTime('2026-10-10', '09:00').toISOString(),
      }).reminderAt,
    ).toBe(atTime('2026-10-10', '09:00').toISOString());
  });

  it('tâche répétée : une ancienne donnée avec un rappel trop tard donne une suivante sans rappel', () => {
    const item: WorkItem = {
      ...parseInput(workItemInputSchema, base),
      id: 'w1',
      kind: 'task',
      completedAt: null,
      space: 'personal',
      repeat: 'weekly',
      reminderAt: atTime('2026-10-12', '09:00').toISOString(),
    };
    expect(nextOccurrenceInput(item)?.reminderAt).toBeNull();
    const ok = { ...item, reminderAt: atTime('2026-10-09', '18:00').toISOString() };
    expect(nextOccurrenceInput(ok)?.reminderAt).toBe(atTime('2026-10-16', '18:00').toISOString());
  });
});
