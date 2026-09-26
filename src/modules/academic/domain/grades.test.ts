import type { Exam } from './exam';
import { formatGrade, gradeOn20, gradesBySubject, overallAverage, weightedAverage } from './grades';

const exam = (over: Partial<Exam>): Exam => ({
  id: 'e',
  subjectId: 's1',
  title: null,
  date: '2026-09-01',
  time: null,
  durationMinutes: null,
  room: null,
  description: null,
  reminderDays: [],
  reminderTime: '09:00',
  grade: null,
  gradeMax: 20,
  coefficient: 1,
  timetableId: null,
  ...over,
});

describe('notes et moyennes', () => {
  it('ramène toute note sur 20', () => {
    expect(gradeOn20(exam({ grade: 45, gradeMax: 50 }))).toBe(18);
    expect(gradeOn20(exam({ grade: null }))).toBeNull();
  });

  it('pondère par les coefficients et ignore les examens non notés', () => {
    const exams = [
      exam({ id: 'a', grade: 10, coefficient: 1 }),
      exam({ id: 'b', grade: 16, coefficient: 3 }),
      exam({ id: 'c', grade: null, coefficient: 5 }),
    ];
    expect(weightedAverage(exams)).toBe(14.5);
    expect(weightedAverage([exam({ grade: null })])).toBeNull();
  });

  it('regroupe par matière, dans l’ordre des dates, et calcule la moyenne générale', () => {
    const exams = [
      exam({ id: 'a', subjectId: 's1', date: '2026-10-01', grade: 12 }),
      exam({ id: 'b', subjectId: 's1', date: '2026-09-01', grade: 8 }),
      exam({ id: 'c', subjectId: 's2', date: '2026-09-15', grade: 18 }),
      exam({ id: 'd', subjectId: 's3', grade: null }),
    ];
    const by = gradesBySubject(exams);
    expect(by.find((s) => s.subjectId === 's1')?.history.map((h) => h.examId)).toEqual(['b', 'a']);
    expect(by.find((s) => s.subjectId === 's1')?.average).toBe(10);
    expect(by.find((s) => s.subjectId === 's3')?.average).toBeNull();
    expect(overallAverage(by)).toBe(14);
    expect(overallAverage([])).toBeNull();
  });

  it('affiche les notes sans zéro inutile', () => {
    expect(formatGrade(14, 'fr')).toBe('14');
    expect(formatGrade(14.5, 'fr')).toBe('14,5');
    expect(formatGrade(14.5, 'en')).toBe('14.5');
  });
});
