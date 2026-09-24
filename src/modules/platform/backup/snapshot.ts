import { z } from 'zod';

import { notifyChange, nowIso, type Db, type SqlValue } from '@/shared/db';
import { AppError } from '@/shared/errors';

/**
 * Sauvegarde locale : une photo complète de la base, en JSON.
 * Les tables sont listées dans l'ordre des clés étrangères (parents d'abord) :
 * on les vide dans l'ordre inverse et on les remplit dans cet ordre.
 * Les pièces jointes (fichiers) ne sont pas incluses : seule leur fiche l'est.
 */
export const BACKUP_TABLES = [
  'app_settings',
  'sync_outbox',
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
  'notes',
  'attachments',
  'study_sessions',
  'habits',
  'habit_logs',
  'work_subtasks',
  'revision_blocks',
  'mood_logs',
  'sync_conflicts',
  'sync_files',
] as const;

export const BACKUP_FORMAT = 'mysky-backup';
export const BACKUP_VERSION = 1;

const sqlValue = z.union([z.string(), z.number(), z.null()]);
const row = z.record(z.string(), sqlValue);

export const backupSnapshotSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  schemaVersion: z.number().int().nonnegative(),
  createdAt: z.string(),
  tables: z.record(z.string(), z.array(row)),
});

export type BackupSnapshot = z.infer<typeof backupSnapshotSchema>;

async function schemaVersionOf(db: Db): Promise<number> {
  const r = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  return r?.user_version ?? 0;
}

/** Lit toute la base (toutes les tables, y compris les réglages et la file de synchronisation). */
export async function createSnapshot(db: Db): Promise<BackupSnapshot> {
  const tables: Record<string, Record<string, SqlValue>[]> = {};
  for (const table of BACKUP_TABLES) {
    // Nom de table issu de la liste ci-dessus (jamais d'une saisie), donc sûr à insérer.
    tables[table] = await db.getAllAsync<Record<string, SqlValue>>(`SELECT * FROM ${table}`, []);
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    schemaVersion: await schemaVersionOf(db),
    createdAt: nowIso(),
    tables,
  };
}

/** Compte les éléments d'une sauvegarde (pour l'afficher). */
export function snapshotSummary(snapshot: BackupSnapshot): { items: number } {
  let items = 0;
  for (const table of BACKUP_TABLES) {
    if (table === 'app_settings' || table === 'sync_outbox') continue;
    items += snapshot.tables[table]?.length ?? 0;
  }
  return { items };
}

/** Vérifie qu'un texte JSON est bien une sauvegarde MySky lisible par cette version de l'app. */
export async function parseSnapshot(db: Db, text: string): Promise<BackupSnapshot> {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch {
    throw new AppError('validation', 'backupUnreadable');
  }
  const parsed = backupSnapshotSchema.safeParse(raw);
  if (!parsed.success) throw new AppError('validation', 'backupUnreadable');
  if (parsed.data.schemaVersion > (await schemaVersionOf(db)))
    throw new AppError('validation', 'backupTooRecent');
  return parsed.data;
}

/**
 * Remplace TOUT le contenu de la base par la sauvegarde, dans une seule transaction :
 * si quelque chose échoue, la base reste telle qu'elle était.
 * Les colonnes inconnues (sauvegarde plus ancienne ou plus récente) sont ignorées.
 */
export async function restoreSnapshot(db: Db, snapshot: BackupSnapshot): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const table of [...BACKUP_TABLES].reverse()) {
      await txn.runAsync(`DELETE FROM ${table}`, []);
    }
    for (const table of BACKUP_TABLES) {
      const rows = snapshot.tables[table] ?? [];
      if (rows.length === 0) continue;
      const columns = (
        await txn.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`, [])
      ).map((c) => c.name);
      const known = new Set(columns);
      for (const r of rows) {
        const cols = Object.keys(r).filter((c) => known.has(c));
        if (cols.length === 0) continue;
        await txn.runAsync(
          `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
          cols.map((c) => r[c] ?? null),
        );
      }
    }
  });
  notifyChange(BACKUP_TABLES);
}

/** Vide toute la base (suppression de toutes les données, §« Supprimer mes données »). */
export async function clearDatabase(db: Db): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const table of [...BACKUP_TABLES].reverse()) {
      await txn.runAsync(`DELETE FROM ${table}`, []);
    }
  });
  notifyChange(BACKUP_TABLES);
}
