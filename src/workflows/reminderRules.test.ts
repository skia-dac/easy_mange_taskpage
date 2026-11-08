import {
  assertReminderNotPast,
  createPersonalEvent,
  createWorkItem,
  getPersonalEvent,
  getWorkItem,
  postponedReminder,
  rescheduleWorkItem,
  restoreWorkDates,
  updatePersonalEvent,
  updateWorkItem,
} from '@/modules/productivity';
import { atTime } from '@/shared/dates';
import type { Db } from '@/shared/db';
import { ValidationError } from '@/shared/validation';
import { createTestDb } from '@/test/memoryDb';

import { moveCalendarItem } from './moveItem';

jest.mock('@/modules/platform', () => ({}));

// Jeudi 1er octobre 2026, 10:00.
const NOW = new Date(2026, 9, 1, 10, 0);
jest.useFakeTimers({ now: NOW, advanceTimers: true });

const base = { priority: 'normal', status: 'todo' } as const;
const at = (day: string, time: string) => atTime(day, time).toISOString();

/** Le champ fautif et sa clé de message, ou null si rien n'est refusé. */
async function refusal(p: Promise<unknown>): Promise<Record<string, string> | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof ValidationError) return e.fields;
    throw e;
  }
}

let db: Db & { close(): void };
beforeEach(async () => {
  jest.setSystemTime(NOW);
  db = await createTestDb();
});
afterEach(() => db.close());

describe('« Retirer la date » d’une tâche', () => {
  it('retire aussi l’heure limite ; un rappel à venir reste à son heure', async () => {
    const id = await createWorkItem(db, 'task', {
      ...base,
      title: 'Rapport',
      dueDate: '2026-10-10',
      dueTime: '14:00',
      reminderAt: at('2026-10-09', '18:00'),
    });
    await rescheduleWorkItem(db, 'task', id, null);
    expect(await getWorkItem(db, 'task', id)).toMatchObject({
      dueDate: null,
      dueTime: null,
      reminderAt: at('2026-10-09', '18:00'),
    });
  });

  it('un rappel déjà passé part avec la date (il ne sonnerait jamais)', async () => {
    const id = await createWorkItem(db, 'task', {
      ...base,
      title: 'Rapport',
      dueDate: '2026-10-10',
      dueTime: '14:00',
    });
    // Un rappel enregistré il y a longtemps (avant la règle, ou passé depuis).
    await db.runAsync('UPDATE tasks SET reminder_at = ? WHERE id = ?', [
      at('2026-09-30', '18:00'),
      id,
    ]);
    await rescheduleWorkItem(db, 'task', id, null);
    expect(await getWorkItem(db, 'task', id)).toMatchObject({
      dueDate: null,
      dueTime: null,
      reminderAt: null,
    });
    expect(
      postponedReminder({ dueDate: '2026-10-10', reminderAt: at('2026-09-30', '18:00') }, null),
    ).toBeNull();
  });

  it('« Annuler » remet la date et l’heure', async () => {
    const id = await createWorkItem(db, 'task', {
      ...base,
      title: 'Rapport',
      dueDate: '2026-10-10',
      dueTime: '14:00',
    });
    await rescheduleWorkItem(db, 'task', id, null);
    await restoreWorkDates(db, [{ kind: 'task', id, dueDate: '2026-10-10', dueTime: '14:00' }]);
    expect(await getWorkItem(db, 'task', id)).toMatchObject({
      dueDate: '2026-10-10',
      dueTime: '14:00',
    });
  });

  it('reporter à une autre date garde l’heure limite', async () => {
    const id = await createWorkItem(db, 'task', {
      ...base,
      title: 'Rapport',
      dueDate: '2026-10-10',
      dueTime: '14:00',
    });
    await rescheduleWorkItem(db, 'task', id, '2026-10-12');
    expect(await getWorkItem(db, 'task', id)).toMatchObject({
      dueDate: '2026-10-12',
      dueTime: '14:00',
    });
  });
});

describe('un rappel choisi dans le passé est refusé', () => {
  it('règle du domaine : seulement quand le rappel change', () => {
    const past = at('2026-09-30', '18:00');
    expect(() => assertReminderNotPast(past, null, NOW)).toThrow(ValidationError);
    expect(() => assertReminderNotPast(past, past, NOW)).not.toThrow();
    expect(() => assertReminderNotPast(at('2026-10-02', '09:00'), null, NOW)).not.toThrow();
    expect(() => assertReminderNotPast(null, past, NOW)).not.toThrow();
  });

  it('tâche : refusée à la création, avec un message clair', async () => {
    const fields = await refusal(
      createWorkItem(db, 'task', {
        ...base,
        title: 'Rapport',
        dueDate: '2026-10-10',
        reminderAt: at('2026-10-01', '09:00'),
      }),
    );
    expect(fields).toEqual({ reminderAt: 'validation.reminderPast' });
  });

  it('tâche : un ancien rappel passé ne bloque pas la modification ; en choisir un autre passé, si', async () => {
    const id = await createWorkItem(db, 'task', {
      ...base,
      title: 'Rapport',
      dueDate: '2026-10-10',
    });
    const old = at('2026-09-29', '18:00');
    await db.runAsync('UPDATE tasks SET reminder_at = ? WHERE id = ?', [old, id]);
    const w = (await getWorkItem(db, 'task', id))!;
    // Renommer : le rappel (passé) ne change pas, rien n'est refusé.
    await updateWorkItem(db, 'task', id, { ...w, title: 'Rapport final' });
    expect(await getWorkItem(db, 'task', id)).toMatchObject({
      title: 'Rapport final',
      reminderAt: old,
    });
    // Un autre moment passé : refusé, rien n'est écrit.
    expect(
      await refusal(
        updateWorkItem(db, 'task', id, { ...w, reminderAt: at('2026-09-30', '18:00') }),
      ),
    ).toEqual({ reminderAt: 'validation.reminderPast' });
    expect((await getWorkItem(db, 'task', id))?.reminderAt).toBe(old);
    // Un moment à venir : accepté. Le retirer aussi.
    await updateWorkItem(db, 'task', id, { ...w, reminderAt: at('2026-10-09', '18:00') });
    await updateWorkItem(db, 'task', id, { ...w, reminderAt: null });
    expect((await getWorkItem(db, 'task', id))?.reminderAt).toBeNull();
  });

  it('rendez-vous : même règle à la création et à la modification', async () => {
    const event = { title: 'Dentiste', date: '2026-10-05', startTime: '09:00', endTime: null };
    expect(
      await refusal(createPersonalEvent(db, { ...event, reminderAt: at('2026-09-30', '08:00') })),
    ).toEqual({ reminderAt: 'validation.reminderPast' });
    const id = await createPersonalEvent(db, { ...event, reminderAt: at('2026-10-04', '18:00') });
    const old = at('2026-09-30', '08:00');
    await db.runAsync('UPDATE personal_events SET reminder_at = ? WHERE id = ?', [old, id]);
    const e = (await getPersonalEvent(db, id))!;
    await updatePersonalEvent(db, id, { ...e, title: 'Dentiste (contrôle)' });
    expect((await getPersonalEvent(db, id))?.title).toBe('Dentiste (contrôle)');
    expect(
      await refusal(updatePersonalEvent(db, id, { ...e, reminderAt: at('2026-10-01', '09:00') })),
    ).toEqual({ reminderAt: 'validation.reminderPast' });
  });

  it('rendez-vous avancé dans le calendrier : un rappel qui tomberait dans le passé part', async () => {
    const id = await createPersonalEvent(db, {
      title: 'Dentiste',
      date: '2026-10-02',
      startTime: '09:00',
      endTime: '10:00',
      reminderAt: at('2026-10-01', '18:00'),
    });
    const event = (await getPersonalEvent(db, id))!;
    await moveCalendarItem(
      db,
      { kind: 'event', sortTime: '09:00', event },
      { date: '2026-10-01', startTime: '11:00', endTime: '12:00' },
    );
    // Le rappel décalé (30 septembre à 20:00) serait passé : le déplacement se fait sans lui.
    expect(await getPersonalEvent(db, id)).toMatchObject({ date: '2026-10-01', reminderAt: null });
  });
});
