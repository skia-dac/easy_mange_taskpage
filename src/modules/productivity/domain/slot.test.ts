import { createTestDb } from '@/test/memoryDb';

import { createSlot, getSlot, listSlots, updateSlot } from '../data/slotData';
import type { PersonalEvent } from './personalEvent';
import {
  copyWeekInputs,
  isOvernight,
  rotationOf,
  slotMinutes,
  slotOccurrences,
  type Slot,
} from './slot';

const slot = (over: Partial<Slot>): Slot => ({
  id: 's',
  title: 'Travail',
  weekdays: [1, 2, 3, 4, 5],
  startTime: '08:00',
  endTime: '17:00',
  location: null,
  note: null,
  rotation: 'every',
  validFrom: '2026-09-01',
  validUntil: null,
  colorId: 'blue',
  space: 'work',
  ...over,
});

describe('planning : créneaux fixes', () => {
  it('se répètent aux jours choisis, dans leur période', () => {
    const occ = slotOccurrences(
      [slot({ validUntil: '2026-09-24' })],
      '2026-09-21',
      '2026-09-27',
      '2026-09-21',
      1,
    );
    expect(occ.map((o) => o.date)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
    ]);
    expect(occ[0]).toMatchObject({
      id: 's:2026-09-21'.replace(/^/, 'slot:'),
      space: 'work',
      startTime: '08:00',
    });
  });

  it('rotation A / B : une semaine sur deux', () => {
    expect(rotationOf('2026-09-23', '2026-09-21', 1)).toBe('A');
    expect(rotationOf('2026-09-30', '2026-09-21', 1)).toBe('B');
    expect(rotationOf('2026-09-16', '2026-09-21', 1)).toBe('B');
    const nights = slot({
      id: 'n',
      rotation: 'B',
      weekdays: [1],
      startTime: '22:00',
      endTime: '06:00',
    });
    const occ = slotOccurrences([nights], '2026-09-21', '2026-10-04', '2026-09-21', 1);
    expect(occ.map((o) => o.date)).toEqual(['2026-09-28']);
    expect(isOvernight(nights)).toBe(true);
    expect(slotMinutes(nights)).toBe(480);
    expect(occ[0]!.endTime).toBe('23:59');
  });

  it('copier la semaine dernière : sans doublon, sans les créneaux fixes', () => {
    const ev = (id: string, date: string, title = 'Réunion'): PersonalEvent => ({
      id,
      title,
      date,
      startTime: '10:00',
      endTime: '11:00',
      description: null,
      reminderAt: null,
      space: 'work',
    });
    const events = [
      ev('a', '2026-09-15'),
      ev('b', '2026-09-17', 'Client'),
      ev('c', '2026-09-24', 'Client'), // déjà copié
      ev('slot:s:2026-09-16', '2026-09-16', 'Travail'),
    ];
    expect(copyWeekInputs(events, '2026-09-14', 'work').map((e) => [e.date, e.title])).toEqual([
      ['2026-09-22', 'Réunion'],
    ]);
  });

  it('enregistrement : jours, rotation et nuit gardés', async () => {
    const db = await createTestDb();
    const id = await createSlot(db, {
      title: 'Garde',
      weekdays: [5, 1, 1],
      startTime: '22:00',
      endTime: '06:00',
      rotation: 'A',
      validFrom: '2026-09-01',
    });
    await updateSlot(db, id, { ...(await getSlot(db, id))!, title: 'Garde de nuit' });
    const [saved] = await listSlots(db);
    expect(saved).toMatchObject({
      title: 'Garde de nuit',
      weekdays: [1, 5],
      rotation: 'A',
      space: 'work',
    });
    db.close();
  });
});
