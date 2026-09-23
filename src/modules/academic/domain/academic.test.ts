import { ValidationError, parseInput } from '@/shared/validation';

import { courseInputSchema, type CourseSeries } from './course';
import { countdown } from './exam';
import { occurrencesInRange } from './occurrences';
import { activeTimetable, timetableInputSchema } from './timetable';

const base: CourseSeries = {
  id: 's1',
  subjectId: 'mkt',
  timetableId: 't1',
  title: null,
  teacher: 'Prof. Martin',
  room: 'B12',
  courseType: 'lecture',
  recurrence: 'weekly',
  weekday: 1, // lundi
  validFrom: '2026-09-01',
  validUntil: '2026-12-20',
  startTime: '08:00',
  endTime: '10:00',
  description: null,
};

describe('occurrencesInRange — cours récurrents', () => {
  it('produit chaque lundi de la période, et seulement dans la période (critère 6)', () => {
    const all = occurrencesInRange([base], '2026-08-01', '2027-01-31');
    expect(all).toHaveLength(15);
    expect(all[0]?.date).toBe('2026-09-07');
    expect(all.at(-1)?.date).toBe('2026-12-14');
  });

  it('ne produit rien en dehors de la période de validité', () => {
    expect(occurrencesInRange([base], '2026-12-21', '2027-01-10')).toEqual([]);
  });

  it('respecte la plage demandée', () => {
    expect(occurrencesInRange([base], '2026-09-21', '2026-09-27').map((o) => o.date)).toEqual([
      '2026-09-21',
    ]);
  });

  it('un cours unique n’apparaît qu’une fois', () => {
    const once: CourseSeries = {
      ...base,
      recurrence: 'none',
      weekday: 3,
      validFrom: '2026-09-23',
      validUntil: '2026-09-23',
    };
    expect(occurrencesInRange([once], '2026-09-01', '2026-12-31').map((o) => o.date)).toEqual([
      '2026-09-23',
    ]);
  });

  it('trie par date puis par heure', () => {
    const later = { ...base, id: 's2', startTime: '14:00', endTime: '16:00' };
    const r = occurrencesInRange([later, base], '2026-09-21', '2026-09-21');
    expect(r.map((o) => o.seriesId)).toEqual(['s1', 's2']);
  });
});

describe('saisie d’un cours', () => {
  const input = {
    subjectId: 'mkt',
    courseType: 'lecture' as const,
    recurrence: 'weekly' as const,
    weekday: 1,
    startDate: '2026-09-01',
    endDate: '2026-12-20',
    startTime: '08:00',
    endTime: '10:00',
  };

  it('accepte un cours hebdomadaire valide', () => {
    const v = parseInput(courseInputSchema, input);
    expect(v).toMatchObject({ weekday: 1, validFrom: '2026-09-01', validUntil: '2026-12-20' });
  });

  it('refuse une heure de fin avant (ou égale à) l’heure de début (§25)', () => {
    expect(() => parseInput(courseInputSchema, { ...input, endTime: '08:00' })).toThrow(
      ValidationError,
    );
    try {
      parseInput(courseInputSchema, { ...input, endTime: '07:00' });
    } catch (e) {
      expect((e as ValidationError).fields).toEqual({ endTime: 'validation.endAfterStart' });
    }
  });

  it('exige une date de fin pour un cours récurrent (règle 2)', () => {
    try {
      parseInput(courseInputSchema, { ...input, endDate: null });
      throw new Error('aurait dû échouer');
    } catch (e) {
      expect((e as ValidationError).fields.endDate).toBe('validation.required');
    }
  });

  it('exige une matière', () => {
    try {
      parseInput(courseInputSchema, { ...input, subjectId: '' });
      throw new Error('aurait dû échouer');
    } catch (e) {
      expect((e as ValidationError).fields.subjectId).toBe('validation.subjectRequired');
    }
  });

  it('un cours unique prend le jour de sa date', () => {
    const v = parseInput(courseInputSchema, {
      ...input,
      recurrence: 'none',
      startDate: '2026-09-23',
      endDate: null,
    });
    expect(v).toMatchObject({ weekday: 3, validFrom: '2026-09-23', validUntil: '2026-09-23' });
  });
});

describe('emplois du temps', () => {
  const s1 = { id: 'a', name: 'Semestre 1', validFrom: '2026-09-01', validUntil: '2026-12-20' };
  const s2 = { id: 'b', name: 'Semestre 2', validFrom: '2027-01-05', validUntil: '2027-05-30' };

  it('trouve l’emploi du temps actif selon la date (§21)', () => {
    expect(activeTimetable([s1, s2], '2026-09-23')?.id).toBe('a');
    expect(activeTimetable([s1, s2], '2027-02-01')?.id).toBe('b');
    expect(activeTimetable([s1, s2], '2026-12-25')).toBeUndefined();
  });

  it('refuse une fin avant le début', () => {
    expect(() =>
      parseInput(timetableInputSchema, {
        name: 'X',
        validFrom: '2026-12-20',
        validUntil: '2026-09-01',
      }),
    ).toThrow(ValidationError);
  });
});

describe('compte à rebours des examens (§68)', () => {
  it.each([
    ['2026-09-23', { kind: 'today' }],
    ['2026-09-24', { kind: 'tomorrow' }],
    ['2026-10-12', { kind: 'inDays', days: 19 }],
    ['2026-09-22', { kind: 'past' }],
  ])('%s', (date, expected) => {
    expect(countdown(date, '2026-09-23')).toEqual(expected);
  });
});
