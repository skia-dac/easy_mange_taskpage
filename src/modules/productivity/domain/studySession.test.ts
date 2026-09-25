import { createTestDb } from '@/test/memoryDb';

import {
  endStudySession,
  getActiveStudySession,
  listStudySessions,
  startStudySession,
} from '../data/studyCommands';
import { elapsedMinutes, isActive, remainingSeconds, studyTotals } from './studySession';

describe('sessions de révision', () => {
  const now = new Date('2026-09-23T10:00:00.000Z');

  it('calcule le temps restant et écoulé', () => {
    const s = {
      id: 'a',
      subjectId: null,
      startedAt: '2026-09-23T09:50:00.000Z',
      endedAt: null,
      plannedMinutes: 25,
      kind: 'focus' as const,
    };
    expect(remainingSeconds(s, now)).toBe(15 * 60);
    expect(elapsedMinutes(s, now)).toBe(10);
    expect(isActive(s, now)).toBe(true);
    expect(isActive({ ...s, endedAt: '2026-09-23T09:55:00.000Z' }, now)).toBe(false);
    expect(elapsedMinutes({ ...s, endedAt: '2026-09-23T09:55:00.000Z' }, now)).toBe(5);
  });

  it('totalise le travail (pas les pauses) par matière et par jour', () => {
    const base = { endedAt: null, plannedMinutes: 25, kind: 'focus' as const };
    const t = studyTotals(
      [
        {
          id: '1',
          subjectId: 's1',
          startedAt: '2026-09-22T08:00:00.000Z',
          ...base,
          endedAt: '2026-09-22T08:25:00.000Z',
        },
        {
          id: '2',
          subjectId: 's1',
          startedAt: '2026-09-23T08:00:00.000Z',
          ...base,
          endedAt: '2026-09-23T08:10:00.000Z',
        },
        {
          id: '3',
          subjectId: 's2',
          startedAt: '2026-09-23T09:00:00.000Z',
          ...base,
          endedAt: '2026-09-23T09:30:00.000Z',
        },
        {
          id: '4',
          subjectId: 's2',
          startedAt: '2026-09-23T09:30:00.000Z',
          ...base,
          kind: 'break',
          endedAt: '2026-09-23T09:35:00.000Z',
        },
        {
          id: '5',
          subjectId: 's2',
          startedAt: '2026-09-01T09:30:00.000Z',
          ...base,
          endedAt: '2026-09-01T09:55:00.000Z',
        },
      ],
      '2026-09-21',
      '2026-09-27',
      now,
    );
    expect(t.totalMinutes).toBe(65);
    expect(t.bySubject).toEqual([
      { subjectId: 's1', minutes: 35 },
      { subjectId: 's2', minutes: 30 },
    ]);
    expect(t.byDay.get('2026-09-23')).toBe(40);
  });

  it('enregistre, termine et liste les sessions sur une vraie base', async () => {
    const db = await createTestDb();
    const first = await startStudySession(db, {
      subjectId: null,
      startedAt: '2026-09-23T09:00:00.000Z',
      plannedMinutes: 25,
    });
    const second = await startStudySession(db, {
      subjectId: null,
      startedAt: '2026-09-23T09:30:00.000Z',
      plannedMinutes: 25,
    });
    // Une seule session ouverte à la fois : la première a été clôturée.
    expect((await getActiveStudySession(db))?.id).toBe(second);
    await endStudySession(db, second, '2026-09-23T09:40:00.000Z');
    expect(await getActiveStudySession(db)).toBeNull();
    const list = await listStudySessions(db, '2026-09-23', '2026-09-23');
    expect(list.map((s) => s.id)).toEqual([second, first]);
    expect(list.every((s) => s.endedAt !== null)).toBe(true);
    db.close();
  });
});
