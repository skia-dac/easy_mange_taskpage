import { createTestDb } from '@/test/memoryDb';

import {
  createCheckpoint,
  createHabit,
  deleteHabit,
  listCheckpoints,
  listHabitLogs,
  setHabitDone,
  setHabitDuration,
  updateCheckpoint,
} from '../data/habitCommands';
import { totalDuration, weightChange } from './habit';

describe('sport : durée facultative, photo et poids', () => {
  it('la durée est facultative, se garde quand on recoche, et noter une durée coche le jour', async () => {
    const db = await createTestDb();
    const id = await createHabit(db, { name: 'Sport', icon: 'activity', tracksBody: true });
    await setHabitDone(db, id, '2026-09-21', true);
    let logs = await listHabitLogs(db, '2026-09-01', '2026-09-30');
    expect(logs[0]?.durationMinutes).toBeNull();
    await setHabitDuration(db, id, '2026-09-21', 45);
    await setHabitDone(db, id, '2026-09-21', true);
    await setHabitDuration(db, id, '2026-09-23', 30);
    logs = await listHabitLogs(db, '2026-09-01', '2026-09-30');
    expect(logs.map((l) => [l.date, l.status, l.durationMinutes])).toEqual([
      ['2026-09-21', 'done', 45],
      ['2026-09-23', 'done', 30],
    ]);
    expect(totalDuration(logs, id, '2026-09-01', '2026-09-30')).toBe(75);
    await expect(setHabitDuration(db, id, '2026-09-24', 0)).rejects.toThrow();
    db.close();
  });

  it('point de départ puis progression : photo ou poids obligatoire, écart calculé', async () => {
    const db = await createTestDb();
    const id = await createHabit(db, { name: 'Sport', tracksBody: true });
    await expect(createCheckpoint(db, { habitId: id, date: '2026-09-01' })).rejects.toThrow();
    const start = await createCheckpoint(db, {
      habitId: id,
      date: '2026-09-01',
      weightKg: 82.36,
      photoPath: 'attachments/progress/x/a.jpg',
    });
    await createCheckpoint(db, { habitId: id, date: '2026-09-22', weightKg: 79.9 });
    await updateCheckpoint(db, start, {
      habitId: id,
      date: '2026-09-01',
      weightKg: 82.4,
      photoPath: 'attachments/progress/x/a.jpg',
    });
    const points = await listCheckpoints(db, id);
    expect(points.map((p) => p.weightKg)).toEqual([82.4, 79.9]);
    expect(weightChange(points)?.deltaKg).toBe(-2.5);
    await deleteHabit(db, id);
    expect(await listCheckpoints(db, id)).toEqual([]);
    db.close();
  });
});
