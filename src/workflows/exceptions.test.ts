import {
  cancelOccurrence,
  createCourse,
  createOffPeriod,
  createSubject,
  endSeriesBefore,
  listCourseExceptions,
  listCourseSeries,
  listOffPeriods,
  occurrencesInRange,
  overrideOccurrence,
  restoreOccurrence,
  splitSeries,
} from '@/modules/academic';
import type { Db } from '@/shared/db';
import { ValidationError } from '@/shared/validation';
import { createTestDb } from '@/test/memoryDb';

let db: Db & { close(): void };
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

const input = (subjectId: string) => ({
  subjectId,
  courseType: 'lecture' as const,
  recurrence: 'weekly' as const,
  weekday: 1,
  startDate: '2026-09-07',
  endDate: '2026-12-14',
  startTime: '08:00',
  endTime: '10:00',
  room: 'B12',
});

async function seed() {
  const subjectId = await createSubject(db, { name: 'Marketing', colorId: 'violet' });
  const seriesId = await createCourse(db, input(subjectId));
  return { subjectId, seriesId };
}

async function view(from: string, to: string) {
  const [series, exceptions, offPeriods] = await Promise.all([
    listCourseSeries(db),
    listCourseExceptions(db),
    listOffPeriods(db),
  ]);
  return occurrencesInRange(series, from, to, { exceptions, offPeriods });
}

describe('une seule séance (§27 option 1, §29)', () => {
  it('annuler puis rétablir', async () => {
    const { seriesId } = await seed();
    await cancelOccurrence(db, seriesId, '2026-09-21');
    expect((await view('2026-09-21', '2026-09-21'))[0]?.status).toBe('cancelled');
    await restoreOccurrence(db, seriesId, '2026-09-21');
    expect((await view('2026-09-21', '2026-09-21'))[0]?.status).toBe('normal');
    expect(await listCourseExceptions(db)).toEqual([]);
  });

  it('modifier la salle d’un seul jour ne touche pas les autres', async () => {
    const { seriesId } = await seed();
    await overrideOccurrence(db, { seriesId, date: '2026-09-21', newRoom: 'C04' });
    const rooms = (await view('2026-09-14', '2026-09-28')).map((o) => o.room);
    expect(rooms).toEqual(['B12', 'C04', 'B12']);
  });

  it('refuse une fin avant le début pour une séance', async () => {
    const { seriesId } = await seed();
    await expect(
      overrideOccurrence(db, {
        seriesId,
        date: '2026-09-21',
        newStartTime: '10:00',
        newEndTime: '09:00',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe('ce cours et les suivants (§27 option 2, §28)', () => {
  it('coupe la série : avant inchangé, après avec les nouvelles valeurs', async () => {
    const { subjectId, seriesId } = await seed();
    const newId = await splitSeries(db, seriesId, '2026-10-05', {
      ...input(subjectId),
      startTime: '09:00',
      endTime: '11:00',
    });
    expect(newId).not.toBe(seriesId);
    const all = await view('2026-09-07', '2026-12-14');
    expect(all).toHaveLength(15);
    expect(
      all
        .filter((o) => o.date < '2026-10-05')
        .every((o) => o.startTime === '08:00' && o.seriesId === seriesId),
    ).toBe(true);
    expect(
      all
        .filter((o) => o.date >= '2026-10-05')
        .every((o) => o.startTime === '09:00' && o.seriesId === newId),
    ).toBe(true);
  });

  it('les exceptions après la coupure suivent la nouvelle série', async () => {
    const { subjectId, seriesId } = await seed();
    await cancelOccurrence(db, seriesId, '2026-10-12');
    const newId = await splitSeries(db, seriesId, '2026-10-05', input(subjectId));
    const ex = await listCourseExceptions(db);
    expect(ex[0]?.seriesId).toBe(newId);
    expect((await view('2026-10-12', '2026-10-12'))[0]?.status).toBe('cancelled');
  });

  it('couper dès la première séance revient à modifier toute la série', async () => {
    const { subjectId, seriesId } = await seed();
    const id = await splitSeries(db, seriesId, '2026-09-07', { ...input(subjectId), room: 'D01' });
    expect(id).toBe(seriesId);
    expect(await listCourseSeries(db)).toHaveLength(1);
  });

  it('supprimer ce cours et les suivants arrête la série la veille', async () => {
    const { seriesId } = await seed();
    await endSeriesBefore(db, seriesId, '2026-10-05');
    const dates = (await view('2026-09-07', '2026-12-14')).map((o) => o.date);
    expect(dates.at(-1)).toBe('2026-09-28');
  });
});

describe('vacances (§42)', () => {
  it('suspend les séances pendant la période, et les réaffiche si on supprime les vacances', async () => {
    await seed();
    await createOffPeriod(db, {
      name: 'Toussaint',
      kind: 'holiday',
      startDate: '2026-10-24',
      endDate: '2026-11-02',
      suspendCourses: true,
    });
    expect((await view('2026-10-19', '2026-11-09')).map((o) => o.date)).toEqual([
      '2026-10-19',
      '2026-11-09',
    ]);
  });

  it('refuse une fin avant le début', async () => {
    await expect(
      createOffPeriod(db, {
        name: 'X',
        kind: 'day_off',
        startDate: '2026-11-11',
        endDate: '2026-11-10',
        suspendCourses: true,
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
