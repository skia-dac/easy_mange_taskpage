import { AppError } from '../errors';
import { notifyChange } from './changes';
import { newId, nowIso } from './ids';
import type { Db, SqlValue } from './types';

/**
 * Tables métier synchronisées avec le compte (toutes ont les colonnes SYNC_COLUMNS), dans l'ordre
 * des dépendances (parents d'abord).
 */
export const SYNCED_TABLES = [
  'profiles',
  'subjects',
  'timetables',
  'course_series',
  'course_exceptions',
  'off_periods',
  'exams',
  'tasks',
  'assignments',
  'personal_events',
  'note_categories',
  'notes',
  'attachments',
  'study_sessions',
  'habits',
  'habit_logs',
  'habit_checkpoints',
  'work_subtasks',
  'revision_blocks',
  'mood_logs',
  'money_categories',
  'money_goals',
  'money_loans',
  'money_recurring',
  'money_transactions',
  'work_slots',
] as const;

/** Une table écrite par `EntityWriter` : toujours une table synchronisée. */
export type EntityTable = (typeof SYNCED_TABLES)[number];

export type Values = Record<string, SqlValue>;

const SAFE_NAME = /^[a-z_]+$/;

/**
 * Vérifie les colonnes écrites. Un `undefined` est refusé : il mettrait la colonne à NULL sur le
 * téléphone (`?? null`) alors que JSON l'omet dans la file de synchronisation, et le serveur ne
 * verrait jamais ce changement. L'appelant passe `null` s'il veut vider la colonne.
 */
export function assertSafeColumns(values: Values): string[] {
  const columns = Object.keys(values);
  for (const c of columns) {
    // Les noms de colonnes viennent du code, jamais de l'utilisateur. Garde-fou quand même.
    if (!SAFE_NAME.test(c)) throw new Error(`Nom de colonne invalide : ${c}`);
    if (values[c] === undefined) {
      throw new AppError('saveFailed', `Valeur absente pour la colonne : ${c}`);
    }
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

  /**
   * Modifie une ligne. Si chaque valeur donnée est déjà celle de la ligne, rien n'est écrit : pas
   * de nouvelle date `updated_at`, pas d'entrée dans la file, aucun écran prévenu. Sinon, relire
   * une note puis la quitter la ferait remonter en tête de liste, et un téléphone hors ligne qui
   * n'a fait que relire une vieille version l'enverrait plus tard comme la plus récente.
   */
  async update(table: EntityTable, id: string, values: Values): Promise<void> {
    const columns = assertSafeColumns(values);
    const current = await this.current(table, id, columns);
    if (columns.every((c) => sameValue(current.values[c], values[c] ?? null))) return;
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
    await this.enqueue(table, id, 'delete', { deleted_at: now, updated_at: now }, current.version);
  }

  /** État de synchronisation de la ligne, et la valeur actuelle des colonnes demandées. */
  private async current(
    table: EntityTable,
    id: string,
    columns: string[] = [],
  ): Promise<SyncState & { values: Record<string, unknown> }> {
    // Colonnes déjà vérifiées par `assertSafeColumns`. Les alias évitent toute collision avec
    // `version` ou `sync_status` si l'appelant les écrit lui-même.
    const extra = columns.map((c, i) => `, ${c} AS v${i}`).join('');
    const row = await this.txn.getFirstAsync<SyncState & Record<string, unknown>>(
      `SELECT version, sync_status${extra} FROM ${table} WHERE id = ? AND deleted_at IS NULL`,
      [id],
    );
    if (!row) throw new AppError('notFound', `${table}/${id}`);
    const values: Record<string, unknown> = {};
    columns.forEach((c, i) => {
      values[c] = row[`v${i}`];
    });
    return { version: row.version, sync_status: row.sync_status, values };
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
 * Même valeur en base et dans la modification. Une différence de type (texte « 5 » contre le
 * nombre 5) compte comme un changement : dans le doute, on écrit.
 */
function sameValue(stored: unknown, next: SqlValue): boolean {
  return (stored ?? null) === next;
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
