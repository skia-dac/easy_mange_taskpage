import { AppError } from '../errors';
import { notifyChange } from './changes';
import { newId, nowIso } from './ids';
import type { Db, SqlValue } from './types';

/** Tables métier synchronisées (toutes ont les colonnes SYNC_COLUMNS). */
export type EntityTable =
  | 'subjects'
  | 'timetables'
  | 'course_series'
  | 'exams'
  | 'tasks'
  | 'assignments'
  | 'personal_events'
  | 'course_exceptions'
  | 'off_periods'
  | 'notes'
  | 'attachments';

export type Values = Record<string, SqlValue>;

const SAFE_NAME = /^[a-z_]+$/;

function assertSafeColumns(values: Values): string[] {
  const columns = Object.keys(values);
  for (const c of columns) {
    // Les noms de colonnes viennent du code, jamais de l'utilisateur. Garde-fou quand même.
    if (!SAFE_NAME.test(c)) throw new Error(`Nom de colonne invalide : ${c}`);
  }
  return columns;
}

type SyncState = { version: number; sync_status: string };

/**
 * Écrit les données métier. Chaque écriture :
 * 1. met à jour la table sur le téléphone ;
 * 2. ajoute une entrée dans la file de synchronisation (sync_outbox), dans la même transaction.
 */
export class EntityWriter {
  readonly changed = new Set<string>();

  /** Lectures dans la même transaction que les écritures. */
  readonly db: Db;

  constructor(private readonly txn: Db) {
    this.db = txn;
  }

  async insert(table: EntityTable, values: Values): Promise<string> {
    const columns = assertSafeColumns(values);
    const id = newId();
    const now = nowIso();
    const allColumns = ['id', 'created_at', 'updated_at', 'sync_status', ...columns];
    const params: SqlValue[] = [
      id,
      now,
      now,
      'pending_create',
      ...columns.map((c) => values[c] ?? null),
    ];
    await this.txn.runAsync(
      `INSERT INTO ${table} (${allColumns.join(', ')}) VALUES (${allColumns.map(() => '?').join(', ')})`,
      params,
    );
    await this.enqueue(
      table,
      id,
      'create',
      { ...values, id, created_at: now, updated_at: now },
      null,
    );
    return id;
  }

  async update(table: EntityTable, id: string, values: Values): Promise<void> {
    const columns = assertSafeColumns(values);
    const current = await this.current(table, id);
    const now = nowIso();
    const status = current.sync_status === 'pending_create' ? 'pending_create' : 'pending_update';
    const sets = [...columns.map((c) => `${c} = ?`), 'updated_at = ?', 'sync_status = ?'];
    await this.txn.runAsync(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = ?`, [
      ...columns.map((c) => values[c] ?? null),
      now,
      status,
      id,
    ]);
    await this.enqueue(table, id, 'update', { ...values, updated_at: now }, current.version);
  }

  /** Suppression « logique » : la ligne reste, marquée supprimée, pour être synchronisée. */
  async softDelete(table: EntityTable, id: string): Promise<void> {
    const current = await this.current(table, id);
    const now = nowIso();
    await this.txn.runAsync(
      `UPDATE ${table} SET deleted_at = ?, updated_at = ?, sync_status = 'pending_delete' WHERE id = ?`,
      [now, now, id],
    );
    await this.enqueue(table, id, 'delete', { deleted_at: now }, current.version);
  }

  private async current(table: EntityTable, id: string): Promise<SyncState> {
    const row = await this.txn.getFirstAsync<SyncState>(
      `SELECT version, sync_status FROM ${table} WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    if (!row) throw new AppError('notFound', `${table}/${id}`);
    return row;
  }

  private async enqueue(
    table: EntityTable,
    id: string,
    operation: 'create' | 'update' | 'delete',
    payload: Values,
    baseVersion: number | null,
  ): Promise<void> {
    await this.txn.runAsync(
      `INSERT INTO sync_outbox (mutation_id, entity, entity_id, operation, payload, base_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId(), table, id, operation, JSON.stringify(payload), baseVersion, nowIso()],
    );
    this.changed.add(table);
  }
}

/**
 * Regroupe plusieurs écritures dans une seule transaction : tout est enregistré, ou rien.
 * Les écrans concernés sont prévenus après l'enregistrement.
 */
export async function write<T>(db: Db, work: (w: EntityWriter) => Promise<T>): Promise<T> {
  let result: T | undefined;
  let changed: Set<string> = new Set();
  try {
    await db.withExclusiveTransactionAsync(async (txn) => {
      const writer = new EntityWriter(txn);
      result = await work(writer);
      changed = writer.changed;
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('saveFailed', 'Échec de l’enregistrement', { cause: error });
  }
  notifyChange(changed);
  return result as T;
}
