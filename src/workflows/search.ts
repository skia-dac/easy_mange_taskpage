import {
  searchCourseSeries,
  searchExams,
  searchSubjects,
  type CourseSeries,
  type Exam,
  type Subject,
} from '@/modules/academic';
import { searchTransactions, type Transaction } from '@/modules/finance';
import { getActiveSpaces } from '@/modules/identity';
import {
  searchNotes,
  searchPersonalEvents,
  searchWorkItems,
  workSpace,
  type Note,
  type PersonalEvent,
  type WorkItem,
} from '@/modules/productivity';
import type { Db } from '@/shared/db';

export type SearchResults = {
  subjects: Subject[];
  courses: CourseSeries[];
  notes: Note[];
  assignments: WorkItem[];
  tasks: WorkItem[];
  exams: Exam[];
  events: PersonalEvent[];
  /** Opérations d'argent (note), seulement si l'espace Perso est actif. */
  transactions: Transaction[];
};

export const MIN_QUERY_LENGTH = 2;

export const emptyResults: SearchResults = {
  subjects: [],
  courses: [],
  notes: [],
  assignments: [],
  tasks: [],
  exams: [],
  events: [],
  transactions: [],
};

/** Recherche globale (§81–83) : tous les types, résultats regroupés, dans les espaces actifs. */
export async function searchAll(db: Db, query: string): Promise<SearchResults> {
  const q = query.trim();
  if (q.replace(/[%_\\]/g, '').trim().length < MIN_QUERY_LENGTH) return emptyResults;
  const spaces = await getActiveSpaces(db);
  const study = spaces.includes('study');
  const personal = spaces.includes('personal');
  const [subjects, courses, notes, assignments, tasks, exams, events, transactions] =
    await Promise.all([
      searchSubjects(db, q),
      searchCourseSeries(db, q),
      searchNotes(db, q),
      searchWorkItems(db, 'assignment', q),
      searchWorkItems(db, 'task', q),
      searchExams(db, q),
      searchPersonalEvents(db, q),
      personal ? searchTransactions(db, q) : Promise.resolve([]),
    ]);
  return {
    subjects: study ? subjects : [],
    courses: study ? courses : [],
    // Les notes sont communes aux trois espaces.
    notes,
    assignments: study ? assignments : [],
    tasks: tasks.filter((w) => spaces.includes(workSpace(w))),
    exams: study ? exams : [],
    events: events.filter((e) => spaces.includes(e.space)),
    // L'argent vit dans l'espace Perso.
    transactions,
  };
}

export function countResults(r: SearchResults): number {
  return (
    r.subjects.length +
    r.courses.length +
    r.notes.length +
    r.assignments.length +
    r.tasks.length +
    r.exams.length +
    r.events.length +
    r.transactions.length
  );
}
