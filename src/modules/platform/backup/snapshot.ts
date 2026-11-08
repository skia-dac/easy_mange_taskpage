import { z } from 'zod';

import {
  MARK_OLD_REJECTED_CONFLICTS,
  newId,
  notifyChange,
  nowIso,
  SYNCED_TABLES,
  type Db,
  type SqlValue,
} from '@/shared/db';
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
  'sync_conflicts',
  'sync_files',
] as const;

/**
 * Tables locales volontairement HORS de la sauvegarde : `feedback` (« Donner mon avis ») n'est pas
 * une donnée de l'utilisateur à restaurer ailleurs ; un retour en attente reste sur ce téléphone.
 * Elles sont quand même vidées par « Supprimer toutes mes données » (`clearDatabase`).
 */
export const LOCAL_ONLY_TABLES = ['feedback'] as const;

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

type SnapshotRow = Record<string, SqlValue>;

/**
 * Sauvegarde faite avant la migration 16 : elle peut contenir plusieurs exceptions de cours
 * vivantes pour la même (série, date), refusées par l'index unique. Comme la migration, on garde
 * la ligne au plus petit id et on supprime logiquement les autres (suppression envoyée au serveur).
 * Retourne les lignes à insérer et les ids supprimés.
 */
export function dedupeCourseExceptions(
  rows: readonly SnapshotRow[],
  now: string,
): { rows: SnapshotRow[]; removed: { id: string; version: number }[] } {
  const keep = new Map<string, string>();
  for (const r of rows) {
    if (r.deleted_at !== null && r.deleted_at !== undefined) continue;
    const key = JSON.stringify([r.series_id, r.date]);
    const id = String(r.id);
    const current = keep.get(key);
    if (current === undefined || id < current) keep.set(key, id);
  }
  const removed: { id: string; version: number }[] = [];
  const out = rows.map((r) => {
    if (r.deleted_at !== null && r.deleted_at !== undefined) return r;
    if (keep.get(JSON.stringify([r.series_id, r.date])) === String(r.id)) return r;
    removed.push({ id: String(r.id), version: Number(r.version ?? 0) });
    return { ...r, deleted_at: now, updated_at: now, sync_status: 'pending_delete' };
  });
  return { rows: out, removed };
}

/**
 * Réglages propres à CE téléphone et à son lien avec le compte : jamais repris d'une sauvegarde
 * (qui peut venir d'un autre téléphone, d'un autre compte ou d'avant). Le propriétaire et la
 * dernière synchronisation actuels restent ; les curseurs de réception repartent de zéro, pour
 * que les éléments du compte absents de la sauvegarde reviennent à la prochaine synchronisation.
 */
function isDeviceSyncSetting(key: SqlValue | undefined): boolean {
  return (
    key === 'account_owner' ||
    key === 'last_sync_at' ||
    (typeof key === 'string' && key.startsWith('sync_cursor:'))
  );
}

const SYNCED = new Set<string>(SYNCED_TABLES);

/**
 * Remplace TOUT le contenu de la base par la sauvegarde, dans une seule transaction :
 * si quelque chose échoue, la base reste telle qu'elle était.
 * Les colonnes inconnues (sauvegarde plus ancienne ou plus récente) sont ignorées.
 *
 * Restaurer = la sauvegarde devient la version actuelle, ici et sur le compte : chaque élément
 * restauré repart par la file d'envoi (daté de maintenant). Sur le serveur, il remplace la version
 * qui s'y trouve, et celle-ci est gardée dans les conflits (rien n'est perdu en silence). Sans la
 * file, la synchronisation suivante aurait défait la restauration sans rien dire.
 */
export async function restoreSnapshot(db: Db, snapshot: BackupSnapshot): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    const kept = await txn.getAllAsync<SnapshotRow>(
      "SELECT * FROM app_settings WHERE key IN ('account_owner', 'last_sync_at')",
      [],
    );
    for (const table of [...BACKUP_TABLES].reverse()) {
      await txn.runAsync(`DELETE FROM ${table}`, []);
    }
    const now = nowIso();
    for (const table of BACKUP_TABLES) {
      // Ancienne file d'envoi : remplacée par une entrée par élément restauré (plus bas).
      if (table === 'sync_outbox') continue;
      let rows = snapshot.tables[table] ?? [];
      if (table === 'course_exceptions') rows = dedupeCourseExceptions(rows, now).rows;
      if (table === 'app_settings')
        rows = [...rows.filter((r) => !isDeviceSyncSetting(r.key)), ...kept];
      if (SYNCED.has(table)) {
        rows = rows.map((r) => ({
          ...r,
          updated_at: now,
          sync_status:
            r.sync_status === 'pending_create'
              ? 'pending_create'
              : r.deleted_at !== null && r.deleted_at !== undefined
                ? 'pending_delete'
                : 'pending_update',
        }));
      }
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
        if (SYNCED.has(table) && r.id) {
          // La ligne complète part à la prochaine synchronisation (le moteur relit la ligne).
          const payload: SnapshotRow = {};
          for (const c of cols)
            if (c !== 'version' && c !== 'sync_status') payload[c] = r[c] ?? null;
          await txn.runAsync(
            `INSERT INTO sync_outbox (mutation_id, entity, entity_id, operation, payload, base_version, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              newId(),
              table,
              String(r.id),
              r.sync_status === 'pending_create'
                ? 'create'
                : r.sync_status === 'pending_delete'
                  ? 'delete'
                  : 'update',
              JSON.stringify(payload),
              null,
              now,
            ],
          );
        }
      }
    }
    // Sauvegarde d'avant la migration 21 : les refus du serveur retrouvent leur nature.
    await txn.execAsync(MARK_OLD_REJECTED_CONFLICTS);
  });
  notifyChange(BACKUP_TABLES);
}

/** Vide toute la base (suppression de toutes les données, §« Supprimer mes données »). */
export async function clearDatabase(db: Db): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const table of [...LOCAL_ONLY_TABLES, ...[...BACKUP_TABLES].reverse()]) {
      await txn.runAsync(`DELETE FROM ${table}`, []);
    }
  });
  notifyChange([...BACKUP_TABLES, ...LOCAL_ONLY_TABLES]);
}
