import type { IsoDate } from '@/shared/dates';

import type { Exam } from './exam';

/** Note ramenée sur 20, quel que soit le barème. null si l'examen n'est pas noté. */
export function gradeOn20(exam: Pick<Exam, 'grade' | 'gradeMax'>): number | null {
  if (exam.grade === null || exam.gradeMax <= 0) return null;
  return (exam.grade / exam.gradeMax) * 20;
}

export type GradedExam = Exam & { grade: number };

export function isGraded(exam: Exam): exam is GradedExam {
  return exam.grade !== null;
}

/** Moyenne pondérée par les coefficients, sur 20. null sans aucune note. */
export function weightedAverage(exams: readonly Exam[]): number | null {
  let total = 0;
  let weight = 0;
  for (const e of exams) {
    const g = gradeOn20(e);
    if (g === null) continue;
    total += g * e.coefficient;
    weight += e.coefficient;
  }
  return weight > 0 ? total / weight : null;
}

export type SubjectGrades = {
  subjectId: string;
  average: number | null;
  graded: number;
  /** Notes dans l'ordre des dates, pour le graphique d'évolution. */
  history: { examId: string; date: IsoDate; title: string | null; value: number }[];
};

/** Moyenne et historique par matière ; les matières sans examen noté ont `average: null`. */
export function gradesBySubject(exams: readonly Exam[]): SubjectGrades[] {
  const groups = new Map<string, Exam[]>();
  for (const e of exams) {
    const list = groups.get(e.subjectId) ?? [];
    list.push(e);
    groups.set(e.subjectId, list);
  }
  return [...groups.entries()].map(([subjectId, list]) => {
    const graded = list
      .filter(isGraded)
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''));
    return {
      subjectId,
      average: weightedAverage(list),
      graded: graded.length,
      history: graded.map((e) => ({
        examId: e.id,
        date: e.date,
        title: e.title,
        value: gradeOn20(e) ?? 0,
      })),
    };
  });
}

/** Moyenne générale : moyenne des moyennes de matières (chaque matière compte 1). */
export function overallAverage(subjects: readonly SubjectGrades[]): number | null {
  const values = subjects.map((s) => s.average).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** « 14,5 » ou « 14 » selon la langue, sans zéro inutile. */
export function formatGrade(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
    Math.round(value * 100) / 100,
  );
}
