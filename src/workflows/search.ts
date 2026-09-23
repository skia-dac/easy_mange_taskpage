import {
  searchCourseSeries,
  searchExams,
  searchSubjects,
  type CourseSeries,
  type Exam,
  type Subject,
} from '@/modules/academic';
import { searchNotes, searchWorkItems, type Note, type WorkItem } from '@/modules/productivity';
import type { Db } from '@/shared/db';

export type SearchResults = {
  subjects: Subject[];
  courses: CourseSeries[];
  notes: Note[];
  assignments: WorkItem[];
  tasks: WorkItem[];
  exams: Exam[];
};

export const MIN_QUERY_LENGTH = 2;

export const emptyResults: SearchResults = {
  subjects: [],
  courses: [],
  notes: [],
  assignments: [],
  tasks: [],
  exams: [],
};

/** Recherche globale (§81–83) : tous les types, résultats regroupés. */
export async function searchAll(db: Db, query: string): Promise<SearchResults> {
  const q = query.trim();
  if (q.replace(/[%_\\]/g, '').trim().length < MIN_QUERY_LENGTH) return emptyResults;
  const [subjects, courses, notes, assignments, tasks, exams] = await Promise.all([
    searchSubjects(db, q),
    searchCourseSeries(db, q),
    searchNotes(db, q),
    searchWorkItems(db, 'assignment', q),
    searchWorkItems(db, 'task', q),
    searchExams(db, q),
  ]);
  return { subjects, courses, notes, assignments, tasks, exams };
}

export function countResults(r: SearchResults): number {
  return (
    r.subjects.length +
    r.courses.length +
    r.notes.length +
    r.assignments.length +
    r.tasks.length +
    r.exams.length
  );
}
