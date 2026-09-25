import type { CourseSeries } from '@/modules/academic';

import { defaultPlanOptions, planRevisions } from './revisionPlan';
import type { TodayData } from './today';

const empty: TodayData = { series: [], exams: [], work: [], events: [] };

// Lundi 28 sept. → examen le lundi 5 oct.
const base = {
  examDate: '2026-10-05',
  today: '2026-09-28',
  sessions: 3,
  minutes: 60,
  daysBefore: 6,
  windowStart: '17:00',
  windowEnd: '20:00',
};

const evening: CourseSeries = {
  id: 's',
  subjectId: 'm',
  timetableId: null,
  title: null,
  teacher: null,
  room: null,
  courseType: 'lecture',
  weekday: 7,
  startTime: '17:00',
  endTime: '19:00',
  validFrom: '2026-09-01',
  validUntil: '2026-12-31',
  recurrence: 'weekly',
  description: null,
  reminderMinutes: null,
};

describe('plan de révision', () => {
  it('étale les séances, la dernière la veille de l’examen', () => {
    const plan = planRevisions(empty, base);
    expect(plan.missing).toBe(0);
    expect(plan.blocks.map((b) => b.date)).toEqual(['2026-09-30', '2026-10-02', '2026-10-04']);
    expect(plan.blocks[0]).toMatchObject({ startTime: '17:00', endTime: '18:00' });
  });

  it('évite les cours et laisse une marge', () => {
    const plan = planRevisions({ ...empty, series: [evening] }, { ...base, sessions: 1 });
    // Dimanche 4 oct. : cours 17 h – 19 h, donc séance à 19 h 15 impossible (fin 20 h 15) → autre jour.
    expect(plan.blocks).toEqual([{ date: '2026-10-03', startTime: '17:00', endTime: '18:00' }]);
  });

  it('plus de séances que de jours : plusieurs par jour, et signale ce qui ne rentre pas', () => {
    const plan = planRevisions(empty, {
      ...base,
      daysBefore: 1,
      sessions: 3,
      windowStart: '17:00',
      windowEnd: '19:30',
    });
    expect(plan.blocks.map((b) => `${b.date} ${b.startTime}`)).toEqual([
      '2026-10-04 17:00',
      '2026-10-04 18:15',
    ]);
    expect(plan.missing).toBe(1);
  });

  it('aujourd’hui : seulement après l’heure actuelle ; jamais avant aujourd’hui', () => {
    const plan = planRevisions(empty, {
      ...base,
      examDate: '2026-09-29',
      daysBefore: 5,
      sessions: 1,
      nowTime: '17:20',
    });
    expect(plan.blocks).toEqual([{ date: '2026-09-28', startTime: '17:45', endTime: '18:45' }]);
  });

  it('valeurs par défaut selon le temps restant', () => {
    expect(defaultPlanOptions('2026-10-01', '2026-09-28')).toMatchObject({
      daysBefore: 3,
      sessions: 3,
    });
    expect(defaultPlanOptions('2026-12-01', '2026-09-28')).toMatchObject({
      daysBefore: 7,
      sessions: 5,
    });
  });
});
