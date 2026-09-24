import { nowIso, write, type Db, type EntityWriter } from '@/shared/db';
import { parseInput } from '@/shared/validation';

import { personalEventInputSchema, type PersonalEventInput } from '../domain/personalEvent';
import {
  nextOccurrenceInput,
  workItemInputSchema,
  type WorkItemInput,
  type WorkKind,
  type WorkStatus,
} from '../domain/workItem';
import { tableOf, toWorkItem, type WorkItemRow } from './rows';

function workValues(input: WorkItemInput) {
  const v = parseInput(workItemInputSchema, input);
  return {
    title: v.title,
    description: v.description,
    subject_id: v.subjectId,
    due_date: v.dueDate,
    due_time: v.dueTime,
    priority: v.priority,
    status: v.status,
    completed_at: v.status === 'done' ? nowIso() : null,
    reminder_at: v.reminderAt,
    repeat_rule: v.repeat,
  };
}

/**
 * Tâche répétée qui vient d'être terminée : crée la suivante (une seule fois par passage
 * à « terminé »). Retourne l'id créé, ou null.
 */
async function spawnNext(w: EntityWriter, kind: WorkKind, id: string): Promise<string | null> {
  const row = await w.db.getFirstAsync<WorkItemRow>(`SELECT * FROM ${tableOf(kind)} WHERE id = ?`, [
    id,
  ]);
  if (!row) return null;
  const next = nextOccurrenceInput(toWorkItem(kind)(row));
  if (!next) return null;
  return w.insert(tableOf(kind), workValues(next));
}

export async function createWorkItem(db: Db, kind: WorkKind, input: WorkItemInput) {
  const values = workValues(input);
  return write(db, (w) => w.insert(tableOf(kind), values));
}

export async function updateWorkItem(db: Db, kind: WorkKind, id: string, input: WorkItemInput) {
  const values = workValues(input);
  return write(db, async (w) => {
    // On garde la date de complétion d'origine si l'élément était déjà terminé.
    const current = await w.db.getFirstAsync<{ status: string; completed_at: string | null }>(
      `SELECT status, completed_at FROM ${tableOf(kind)} WHERE id = ?`,
      [id],
    );
    if (values.status === 'done' && current?.status === 'done')
      values.completed_at = current.completed_at;
    await w.update(tableOf(kind), id, values);
    if (values.status === 'done' && current?.status !== 'done') await spawnNext(w, kind, id);
  });
}

/** Marquer rapidement comme terminé (ou revenir à « à faire »). */
export async function setWorkStatus(db: Db, kind: WorkKind, id: string, status: WorkStatus) {
  return write(db, async (w) => {
    const current = await w.db.getFirstAsync<{ status: string }>(
      `SELECT status FROM ${tableOf(kind)} WHERE id = ?`,
      [id],
    );
    await w.update(tableOf(kind), id, {
      status,
      completed_at: status === 'done' ? nowIso() : null,
    });
    if (status === 'done' && current?.status !== 'done') await spawnNext(w, kind, id);
  });
}

export async function deleteWorkItem(db: Db, kind: WorkKind, id: string) {
  return write(db, (w) => w.softDelete(tableOf(kind), id));
}

/** Détache les tâches et devoirs d'une matière supprimée (ils restent consultables). */
export async function detachWorkFromSubject(w: EntityWriter, subjectId: string) {
  for (const kind of ['task', 'assignment'] as const) {
    const rows = await w.db.getAllAsync<{ id: string }>(
      `SELECT id FROM ${tableOf(kind)} WHERE subject_id = ? AND deleted_at IS NULL`,
      [subjectId],
    );
    for (const r of rows) await w.update(tableOf(kind), r.id, { subject_id: null });
  }
}

/** Supprime les tâches et devoirs d'une matière (option « tout supprimer »). */
export async function deleteWorkOfSubject(w: EntityWriter, subjectId: string) {
  for (const kind of ['task', 'assignment'] as const) {
    const rows = await w.db.getAllAsync<{ id: string }>(
      `SELECT id FROM ${tableOf(kind)} WHERE subject_id = ? AND deleted_at IS NULL`,
      [subjectId],
    );
    for (const r of rows) await w.softDelete(tableOf(kind), r.id);
  }
}

function eventValues(input: PersonalEventInput) {
  const v = parseInput(personalEventInputSchema, input);
  return {
    title: v.title,
    date: v.date,
    start_time: v.startTime,
    end_time: v.endTime,
    description: v.description,
    reminder_at: v.reminderAt,
  };
}

export async function createPersonalEvent(db: Db, input: PersonalEventInput) {
  const values = eventValues(input);
  return write(db, (w) => w.insert('personal_events', values));
}

export async function updatePersonalEvent(db: Db, id: string, input: PersonalEventInput) {
  const values = eventValues(input);
  return write(db, (w) => w.update('personal_events', id, values));
}

export async function deletePersonalEvent(db: Db, id: string) {
  return write(db, (w) => w.softDelete('personal_events', id));
}
