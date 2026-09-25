import { getSyncCursor, setLastSyncAt, setSyncCursor } from '@/modules/identity';
import { newId, notifyChange, nowIso, SYNCED_TABLES, type Db, type SqlValue } from '@/shared/db';
import { logger } from '@/shared/logger';

import { deleteLocalFile } from '../files/attachments';

/** Colonnes qui désignent un fichier sur le téléphone : effacé quand la ligne arrive supprimée. */
const FILE_COLUMNS: Partial<Record<string, string>> = {
  attachments: 'local_path',
  profiles: 'photo_path',
  habit_checkpoints: 'photo_path',
};

/**
 * Moteur de synchronisation (architecture §7) :
 * 1. envoi : la file `sync_outbox` (toutes les écritures faites sur le téléphone) est envoyée,
 *    regroupée par élément, avec le numéro de version connu ;
 * 2. réception : les lignes modifiées sur le serveur depuis le dernier curseur sont appliquées,
 *    sauf celles qui ont des modifications locales pas encore envoyées ;
 * 3. conflit (l'élément a changé ailleurs) : la modification la plus récente gagne. Si c'est celle
 *    du serveur, la version locale est gardée dans `sync_conflicts` : rien n'est perdu en silence.
 */

export type SyncedTable = (typeof SYNCED_TABLES)[number];
type Row = Record<string, SqlValue>;

export type Mutation = {
  mutation_id: string;
  entity: SyncedTable;
  entity_id: string;
  operation: 'create' | 'update' | 'delete';
  base_version: number | null;
  payload: Row;
};

export type PushResult =
  | { mutation_id: string; status: 'applied'; version: number }
  | { mutation_id: string; status: 'missing' }
  | { mutation_id: string; status: 'conflict'; server: Record<string, unknown> };

/** Ce que le moteur attend du serveur (Supabase en vrai, un faux serveur dans les tests). */
export interface RemoteApi {
  push(mutations: Mutation[]): Promise<PushResult[]>;
  /** Lignes modifiées après `since` (exclu), triées par `server_updated_at`. */
  pull(table: SyncedTable, since: string | null, limit: number): Promise<Record<string, unknown>[]>;
}

export type SyncReport = { pushed: number; pulled: number; conflicts: number; skipped: number };

const PUSH_BATCH = 100;
export const PULL_PAGE = 500;
const MAX_ROUNDS = 4;
const LOCAL_ONLY = new Set(['sync_status']);
const SERVER_ONLY = new Set(['user_id', 'server_updated_at']);

const isSynced = (t: string): t is SyncedTable => (SYNCED_TABLES as readonly string[]).includes(t);

const columnCache = new Map<string, Set<string>>();
async function columnsOf(db: Db, table: SyncedTable): Promise<Set<string>> {
  const cached = columnCache.get(table);
  if (cached) return cached;
  const cols = new Set(
    (await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`, [])).map((c) => c.name),
  );
  columnCache.set(table, cols);
  return cols;
}

type OutboxRow = {
  mutation_id: string;
  entity: string;
  entity_id: string;
  operation: 'create' | 'update' | 'delete';
  payload: string;
  created_at: string;
};

type Group = { entity: SyncedTable; id: string; ids: string[]; mutation: Mutation };

async function localRow(db: Db, table: SyncedTable, id: string): Promise<Row | null> {
  return db.getFirstAsync<Row>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
}

/** Toutes les colonnes métier d'une ligne locale (sans id, version, sync_status). */
function fullPayload(row: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'version' || LOCAL_ONLY.has(k)) continue;
    out[k] = v;
  }
  return out;
}

function parsePayload(text: string): Row {
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === 'object' ? (v as Row) : {};
  } catch {
    return {};
  }
}

/** Regroupe la file par élément : une seule modification par élément, dans l'ordre d'origine. */
async function buildGroups(db: Db): Promise<Group[]> {
  const rows = await db.getAllAsync<OutboxRow>(
    'SELECT mutation_id, entity, entity_id, operation, payload, created_at FROM sync_outbox ORDER BY created_at, rowid',
    [],
  );
  const groups = new Map<string, { entity: SyncedTable; id: string; rows: OutboxRow[] }>();
  for (const r of rows) {
    if (!isSynced(r.entity)) continue;
    const key = `${r.entity}:${r.entity_id}`;
    const g = groups.get(key) ?? { entity: r.entity, id: r.entity_id, rows: [] };
    g.rows.push(r);
    groups.set(key, g);
  }
  const out: Group[] = [];
  for (const g of groups.values()) {
    const row = await localRow(db, g.entity, g.id);
    if (!row) {
      // L'élément n'existe plus sur le téléphone : rien à envoyer.
      await deleteOutbox(
        db,
        g.rows.map((r) => r.mutation_id),
      );
      continue;
    }
    const first = g.rows[0]!;
    const last = g.rows[g.rows.length - 1]!;
    const payload: Row = {};
    for (const r of g.rows) Object.assign(payload, parsePayload(r.payload));
    const status = String(row.sync_status ?? '');
    const operation =
      first.operation === 'create' && status === 'pending_create'
        ? 'create'
        : last.operation === 'delete'
          ? 'delete'
          : 'update';
    out.push({
      entity: g.entity,
      id: g.id,
      ids: g.rows.map((r) => r.mutation_id),
      mutation: {
        mutation_id: last.mutation_id,
        entity: g.entity,
        entity_id: g.id,
        operation,
        base_version: operation === 'create' ? null : Number(row.version ?? 0),
        payload: operation === 'create' ? fullPayload(row) : payload,
      },
    });
  }
  return out;
}

async function deleteOutbox(db: Db, ids: readonly string[]): Promise<void> {
  for (const id of ids) await db.runAsync('DELETE FROM sync_outbox WHERE mutation_id = ?', [id]);
}

async function markSynced(db: Db, g: Group, version: number): Promise<void> {
  await deleteOutbox(db, g.ids);
  const left = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = ? AND entity_id = ?',
    [g.entity, g.id],
  );
  if ((left?.n ?? 0) === 0)
    await db.runAsync(`UPDATE ${g.entity} SET version = ?, sync_status = 'synced' WHERE id = ?`, [
      version,
      g.id,
    ]);
  else await db.runAsync(`UPDATE ${g.entity} SET version = ? WHERE id = ?`, [version, g.id]);
}

/** Écrit une ligne reçue du serveur dans la base du téléphone (sans passer par la file d'envoi). */
async function applyServerRow(
  db: Db,
  table: SyncedTable,
  server: Record<string, unknown>,
): Promise<void> {
  const cols = await columnsOf(db, table);
  const entries = Object.entries(server).filter(
    ([k]) => cols.has(k) && !SERVER_ONLY.has(k) && !LOCAL_ONLY.has(k),
  );
  const names = entries.map(([k]) => k);
  const values = entries.map(([, v]) =>
    v === undefined || v === null
      ? null
      : typeof v === 'boolean'
        ? v
          ? 1
          : 0
        : typeof v === 'object'
          ? JSON.stringify(v)
          : (v as SqlValue),
  );
  const updates = names.filter((n) => n !== 'id').map((n) => `${n} = excluded.${n}`);
  await db.runAsync(
    `INSERT INTO ${table} (${[...names, 'sync_status'].join(', ')}) VALUES (${[...names, 's'].map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET ${[...updates, "sync_status = 'synced'"].join(', ')}`,
    [...values, 'synced'],
  );
}

async function recordConflict(
  db: Db,
  table: SyncedTable,
  local: Row,
  server: Record<string, unknown>,
) {
  await db.runAsync(
    `INSERT INTO sync_conflicts (id, entity, entity_id, local_payload, server_payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [newId(), table, String(local.id), JSON.stringify(local), JSON.stringify(server), nowIso()],
  );
}

async function push(db: Db, remote: RemoteApi, report: SyncReport, changed: Set<string>) {
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const groups = await buildGroups(db);
    if (groups.length === 0) return;
    let retry = false;
    for (let i = 0; i < groups.length; i += PUSH_BATCH) {
      const batch = groups.slice(i, i + PUSH_BATCH);
      const results = await remote.push(batch.map((g) => g.mutation));
      const byId = new Map(results.map((r) => [r.mutation_id, r]));
      for (const g of batch) {
        const r = byId.get(g.mutation.mutation_id);
        if (!r) continue;
        if (r.status === 'applied') {
          await markSynced(db, g, r.version);
          report.pushed++;
        } else if (r.status === 'missing') {
          // Absent du serveur : on le recrée à partir de la ligne locale complète.
          await db.runAsync(`UPDATE ${g.entity} SET sync_status = 'pending_create' WHERE id = ?`, [
            g.id,
          ]);
          await rewriteOutbox(db, g, 'create');
          retry = true;
        } else {
          const local = await localRow(db, g.entity, g.id);
          if (!local) continue;
          const serverUpdated = String(r.server.updated_at ?? '');
          if (String(local.updated_at ?? '') >= serverUpdated) {
            // Notre modification est la plus récente : on la renvoie sur la version du serveur.
            await db.runAsync(`UPDATE ${g.entity} SET version = ? WHERE id = ?`, [
              Number(r.server.version ?? 0),
              g.id,
            ]);
            await rewriteOutbox(db, g, 'update');
            retry = true;
          } else {
            // Celle du serveur est plus récente : elle gagne, la nôtre est gardée de côté.
            await recordConflict(db, g.entity, local, r.server);
            await deleteOutbox(db, g.ids);
            await applyServerRow(db, g.entity, r.server);
            changed.add(g.entity);
            report.conflicts++;
          }
        }
      }
    }
    if (!retry) return;
  }
}

/** Remplace les modifications d'un élément par une seule, avec la ligne locale complète. */
async function rewriteOutbox(db: Db, g: Group, operation: 'create' | 'update'): Promise<void> {
  const local = await localRow(db, g.entity, g.id);
  if (!local) return;
  await deleteOutbox(db, g.ids);
  await db.runAsync(
    `INSERT INTO sync_outbox (mutation_id, entity, entity_id, operation, payload, base_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), g.entity, g.id, operation, JSON.stringify(fullPayload(local)), null, nowIso()],
  );
}

async function pull(db: Db, remote: RemoteApi, report: SyncReport, changed: Set<string>) {
  for (const table of SYNCED_TABLES) {
    let cursor = await getSyncCursor(db, table);
    for (;;) {
      const rows = await remote.pull(table, cursor, PULL_PAGE);
      if (rows.length === 0) break;
      const filesToDelete: string[] = [];
      await db.withExclusiveTransactionAsync(async (txn) => {
        // Un enfant peut arriver avant son parent (autre table) : clés étrangères vérifiées à la fin.
        await txn.execAsync('PRAGMA defer_foreign_keys = ON');
        for (const row of rows) {
          const id = String(row.id);
          const local = await txn.getFirstAsync<{ sync_status: string }>(
            `SELECT sync_status FROM ${table} WHERE id = ?`,
            [id],
          );
          if (local && local.sync_status !== 'synced') {
            report.skipped++;
            continue;
          }
          const fileColumn = FILE_COLUMNS[table];
          if (fileColumn && row.deleted_at) {
            const local = await txn.getFirstAsync<Record<string, unknown>>(
              `SELECT ${fileColumn} AS path FROM ${table} WHERE id = ?`,
              [id],
            );
            if (typeof local?.path === 'string' && local.path) filesToDelete.push(local.path);
          }
          await applyServerRow(txn, table, row);
          report.pulled++;
          changed.add(table);
        }
      });
      // Supprimé sur un autre appareil : le fichier n'a plus de raison de rester ici.
      for (const path of filesToDelete) {
        try {
          deleteLocalFile(path);
        } catch (e) {
          logger.error(e, { where: 'pull.deleteLocalFile' });
        }
      }
      cursor = String(rows[rows.length - 1]!.server_updated_at);
      await setSyncCursor(db, table, cursor);
      if (rows.length < PULL_PAGE) break;
    }
  }
}

/** Une synchronisation complète : envoi, puis réception. */
export async function syncOnce(db: Db, remote: RemoteApi): Promise<SyncReport> {
  const report: SyncReport = { pushed: 0, pulled: 0, conflicts: 0, skipped: 0 };
  const changed = new Set<string>();
  try {
    await push(db, remote, report, changed);
    await pull(db, remote, report, changed);
    await setLastSyncAt(db, nowIso());
  } finally {
    if (changed.size > 0) notifyChange([...changed, 'sync_conflicts']);
  }
  return report;
}

/** Nombre de modifications locales pas encore envoyées. */
export async function pendingCount(db: Db): Promise<number> {
  const r = await db.getFirstAsync<{ n: number }>(
    "SELECT COUNT(DISTINCT entity || '/' || entity_id) AS n FROM sync_outbox",
    [],
  );
  return r?.n ?? 0;
}

export async function conflictCount(db: Db): Promise<number> {
  const r = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM sync_conflicts WHERE resolved_at IS NULL',
    [],
  );
  return r?.n ?? 0;
}
