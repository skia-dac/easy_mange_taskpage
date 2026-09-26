import type { IsoDate } from '@/shared/dates';
import { nowIso, write, type Db, type EntityWriter } from '@/shared/db';
import { AppError } from '@/shared/errors';
import { isoDate, parseInput, time } from '@/shared/validation';

import { personalEventInputSchema, type PersonalEventInput } from '../domain/personalEvent';
import {
  nextOccurrenceInput,
  postponedReminder,
  workItemInputSchema,
  type WorkItemInput,
  type WorkKind,
  type WorkStatus,
} from '../domain/workItem';
import { tableOf, toWorkItem, type WorkItemRow } from './rows';
import { copySubtasks, deleteSubtasksOf } from './subtaskCommands';

function workValues(input: WorkItemInput, kind: WorkKind) {
  const v = parseInput(workItemInputSchema, input);
  // L'espace n'est écrit que s'il est donné (jamais remis à une valeur par défaut) ;
  // un devoir ou un élément lié à une matière est rangé dans Études.
  const space = kind === 'assignment' || v.subjectId ? 'study' : v.space;
  return {
    ...(space ? { space } : {}),
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
    estimated_minutes: v.estimatedMinutes,
  };
}

/**
 * Tâche répétée qui vient d'être terminée : crée la suivante (une seule fois par passage
 * à « terminé »). Si une occurrence vivante de même titre et même répétition existe déjà à
 * l'échéance suivante (décocher puis recocher), rien n'est créé. Retourne l'id créé, ou null.
 */
async function spawnNext(w: EntityWriter, kind: WorkKind, id: string): Promise<string | null> {
  const row = await w.db.getFirstAsync<WorkItemRow>(
    `SELECT * FROM ${tableOf(kind)} WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  if (!row) return null;
  const next = nextOccurrenceInput(toWorkItem(kind)(row));
  if (!next) return null;
  const existing = await w.db.getFirstAsync<{ id: string }>(
    `SELECT id FROM ${tableOf(kind)}
     WHERE id != ? AND title = ? AND repeat_rule = ? AND due_date = ? AND deleted_at IS NULL
     LIMIT 1`,
    [id, row.title, row.repeat_rule, next.dueDate],
  );
  if (existing) return null;
  const newId = await w.insert(tableOf(kind), workValues(next, kind));
  await copySubtasks(w, kind, id, newId);
  return newId;
}

export async function createWorkItem(db: Db, kind: WorkKind, input: WorkItemInput) {
  const values = workValues(input, kind);
  return write(db, (w) => w.insert(tableOf(kind), values));
}

export async function updateWorkItem(db: Db, kind: WorkKind, id: string, input: WorkItemInput) {
  const values = workValues(input, kind);
  return write(db, async (w) => {
    // On garde la date de complétion d'origine si l'élément était déjà terminé.
    const current = await w.db.getFirstAsync<{ status: string; completed_at: string | null }>(
      `SELECT status, completed_at FROM ${tableOf(kind)} WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    if (values.status === 'done' && current?.status === 'done')
      values.completed_at = current.completed_at;
    await w.update(tableOf(kind), id, values);
    if (values.status === 'done' && current?.status !== 'done') await spawnNext(w, kind, id);
  });
}

/**
 * Marquer rapidement comme terminé (ou revenir à « à faire »). Retourne l'id de l'occurrence
 * suivante créée (tâche répétée qui vient d'être terminée), sinon null.
 */
export async function setWorkStatus(
  db: Db,
  kind: WorkKind,
  id: string,
  status: WorkStatus,
): Promise<string | null> {
  return write(db, async (w) => {
    const current = await w.db.getFirstAsync<{ status: string }>(
      `SELECT status FROM ${tableOf(kind)} WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    await w.update(tableOf(kind), id, {
      status,
      completed_at: status === 'done' ? nowIso() : null,
    });
    if (status === 'done' && current?.status !== 'done') return spawnNext(w, kind, id);
    return null;
  });
}

/**
 * « Annuler » après avoir terminé : remet l'état précédent et supprime l'occurrence suivante
 * créée au passage (tâche répétée), le tout dans une seule transaction.
 */
export async function undoWorkDone(
  db: Db,
  kind: WorkKind,
  id: string,
  previous: WorkStatus,
  spawnedId: string | null,
) {
  return write(db, async (w) => {
    await w.update(tableOf(kind), id, { status: previous, completed_at: null });
    if (spawnedId) {
      await deleteSubtasksOf(w, kind, spawnedId);
      await w.softDelete(tableOf(kind), spawnedId);
    }
  });
}

export async function deleteWorkItem(db: Db, kind: WorkKind, id: string) {
  return write(db, async (w) => {
    await deleteSubtasksOf(w, kind, id);
    await w.softDelete(tableOf(kind), id);
  });
}

async function rescheduleIn(
  w: EntityWriter,
  kind: WorkKind,
  id: string,
  dueDate: IsoDate,
  dueTime?: string | null,
) {
  const row = await w.db.getFirstAsync<WorkItemRow>(
    `SELECT * FROM ${tableOf(kind)} WHERE id = ? AND deleted_at IS NULL`,
    [id],
  );
  if (!row) throw new AppError('notFound');
  const item = toWorkItem(kind)(row);
  await w.update(tableOf(kind), id, {
    due_date: dueDate,
    ...(dueTime === undefined ? {} : { due_time: dueTime }),
    reminder_at: postponedReminder(item, dueDate),
  });
  return item;
}

/**
 * Reporter une tâche (glisser vers la gauche, bilan du soir) ou la déplacer dans la vue semaine.
 * Le rappel suit l'échéance. `dueTime` absent = on garde l'heure actuelle.
 */
export async function rescheduleWorkItem(
  db: Db,
  kind: WorkKind,
  id: string,
  dueDate: IsoDate,
  dueTime?: string | null,
) {
  parseInput(isoDate, dueDate);
  if (dueTime) parseInput(time, dueTime);
  return write(db, async (w) => {
    await rescheduleIn(w, kind, id, dueDate, dueTime);
  });
}

export type WorkDateSnapshot = {
  kind: WorkKind;
  id: string;
  dueDate: IsoDate;
  dueTime: string | null;
};

/**
 * « Tout reporter » (bilan du soir) : reporte plusieurs éléments dans une seule transaction.
 * Retourne leurs échéances d'avant, pour « Annuler » (`restoreWorkDates`).
 */
export async function rescheduleWorkItems(
  db: Db,
  items: readonly { kind: WorkKind; id: string }[],
  dueDate: IsoDate,
): Promise<WorkDateSnapshot[]> {
  parseInput(isoDate, dueDate);
  return write(db, async (w) => {
    const previous: WorkDateSnapshot[] = [];
    for (const it of items) {
      const before = await rescheduleIn(w, it.kind, it.id, dueDate);
      previous.push({ kind: it.kind, id: it.id, dueDate: before.dueDate, dueTime: before.dueTime });
    }
    return previous;
  });
}

/** Remet les échéances enregistrées par `rescheduleWorkItems` (une seule transaction). */
export async function restoreWorkDates(db: Db, previous: readonly WorkDateSnapshot[]) {
  return write(db, async (w) => {
    for (const p of previous) await rescheduleIn(w, p.kind, p.id, p.dueDate, p.dueTime);
  });
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
  const blocks = await w.db.getAllAsync<{ id: string }>(
    'SELECT id FROM revision_blocks WHERE subject_id = ? AND deleted_at IS NULL',
    [subjectId],
  );
  for (const b of blocks) await w.update('revision_blocks', b.id, { subject_id: null });
}

/** Supprime les tâches et devoirs d'une matière (option « tout supprimer »). */
export async function deleteWorkOfSubject(w: EntityWriter, subjectId: string) {
  for (const kind of ['task', 'assignment'] as const) {
    const rows = await w.db.getAllAsync<{ id: string }>(
      `SELECT id FROM ${tableOf(kind)} WHERE subject_id = ? AND deleted_at IS NULL`,
      [subjectId],
    );
    for (const r of rows) {
      await deleteSubtasksOf(w, kind, r.id);
      await w.softDelete(tableOf(kind), r.id);
    }
  }
  const blocks = await w.db.getAllAsync<{ id: string }>(
    'SELECT id FROM revision_blocks WHERE subject_id = ? AND deleted_at IS NULL',
    [subjectId],
  );
  for (const b of blocks) await w.softDelete('revision_blocks', b.id);
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
    ...(v.space ? { space: v.space } : {}),
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

/** « Copier la semaine dernière » : tous les rendez-vous dans une seule transaction. */
export async function createPersonalEvents(
  db: Db,
  inputs: readonly PersonalEventInput[],
): Promise<string[]> {
  const values = inputs.map(eventValues);
  return write(db, async (w) => {
    const ids: string[] = [];
    for (const v of values) ids.push(await w.insert('personal_events', v));
    return ids;
  });
}

/** « Annuler » la copie : supprime les rendez-vous créés, en une transaction. */
export async function deletePersonalEvents(db: Db, ids: readonly string[]) {
  return write(db, async (w) => {
    for (const id of ids) await w.softDelete('personal_events', id);
  });
}
