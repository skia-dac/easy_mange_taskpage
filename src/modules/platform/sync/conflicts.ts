import { newId, notifyChange, nowIso, SYNCED_TABLES, type Db, type SqlValue } from '@/shared/db';

import type { SyncedTable } from './engine';

/**
 * Conflits gardés de côté par la synchronisation (`sync_conflicts`) : la version locale d'une
 * ligne remplacée par celle du serveur, ou une modification refusée par le serveur.
 * L'utilisateur peut restaurer sa version (elle repart par la file d'envoi) ou l'ignorer.
 */
export type SyncConflict = {
  id: string;
  entity: string;
  entityId: string;
  /** Titre lisible de l'élément, si sa ligne en a un (titre, nom, personne…). */
  title: string | null;
  /** Raison donnée par le serveur quand la modification a été refusée. */
  reason: string | null;
  createdAt: string;
  local: Record<string, SqlValue>;
};

type ConflictRow = {
  id: string;
  entity: string;
  entity_id: string;
  local_payload: string;
  server_payload: string;
  created_at: string;
};

const NOT_RESTORED = new Set(['id', 'version', 'sync_status', 'created_at']);
const TITLE_COLUMNS = ['title', 'name', 'person', 'first_name', 'date'];

function parse(text: string): Record<string, SqlValue> {
  try {
    const v: unknown = JSON.parse(text);
    return v && typeof v === 'object' ? (v as Record<string, SqlValue>) : {};
  } catch {
    return {};
  }
}

function titleOf(local: Record<string, SqlValue>): string | null {
  for (const c of TITLE_COLUMNS) {
    const v = local[c];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return null;
}

const isSynced = (t: string): t is SyncedTable => (SYNCED_TABLES as readonly string[]).includes(t);

/** Conflits non résolus, les plus récents d'abord. */
export async function listConflicts(db: Db): Promise<SyncConflict[]> {
  const rows = await db.getAllAsync<ConflictRow>(
    'SELECT * FROM sync_conflicts WHERE resolved_at IS NULL ORDER BY created_at DESC, rowid DESC',
    [],
  );
  return rows.map((r) => {
    const local = parse(r.local_payload);
    const server = parse(r.server_payload);
    return {
      id: r.id,
      entity: r.entity,
      entityId: r.entity_id,
      title: titleOf(local),
      reason: typeof server.reason === 'string' ? server.reason : null,
      createdAt: r.created_at,
      local,
    };
  });
}

/** « Ignorer » : la version du serveur reste, le conflit est marqué résolu. */
export async function ignoreConflict(db: Db, id: string): Promise<void> {
  await db.runAsync('UPDATE sync_conflicts SET resolved_at = ? WHERE id = ?', [nowIso(), id]);
  notifyChange(['sync_conflicts']);
}

/**
 * « Restaurer ma version » : la ligne locale est réécrite avec la version gardée de côté et
 * repart par la file d'envoi (comme toute modification faite sur le téléphone). Si la ligne a
 * disparu entre-temps, elle est recréée.
 */
export async function restoreConflict(db: Db, id: string): Promise<void> {
  const row = await db.getFirstAsync<ConflictRow>('SELECT * FROM sync_conflicts WHERE id = ?', [
    id,
  ]);
  if (!row) return;
  const table = row.entity;
  const local = parse(row.local_payload);
  if (!isSynced(table) || !local.id) {
    await ignoreConflict(db, id);
    return;
  }
  const entityId = String(local.id);
  const now = nowIso();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const cols = new Set(
      (await txn.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`, [])).map(
        (c) => c.name,
      ),
    );
    const values: Record<string, SqlValue> = {};
    for (const [k, v] of Object.entries(local)) {
      if (cols.has(k) && !NOT_RESTORED.has(k)) values[k] = v;
    }
    values.updated_at = now;
    const names = Object.keys(values);
    const current = await txn.getFirstAsync<{ sync_status: string }>(
      `SELECT sync_status FROM ${table} WHERE id = ?`,
      [entityId],
    );
    let operation: 'create' | 'update';
    if (current) {
      operation = 'update';
      const status = current.sync_status === 'pending_create' ? 'pending_create' : 'pending_update';
      await txn.runAsync(
        `UPDATE ${table} SET ${names.map((n) => `${n} = ?`).join(', ')}, sync_status = ? WHERE id = ?`,
        [...names.map((n) => values[n] ?? null), status, entityId],
      );
    } else {
      operation = 'create';
      const all: Record<string, SqlValue> = {
        ...values,
        id: entityId,
        created_at: String(local.created_at ?? now),
      };
      const allNames = [...Object.keys(all), 'sync_status'];
      await txn.runAsync(
        `INSERT INTO ${table} (${allNames.join(', ')}) VALUES (${allNames.map(() => '?').join(', ')})`,
        [...Object.keys(all).map((n) => all[n] ?? null), 'pending_create'],
      );
    }
    await txn.runAsync(
      `INSERT INTO sync_outbox (mutation_id, entity, entity_id, operation, payload, base_version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [newId(), table, entityId, operation, JSON.stringify(values), null, now],
    );
    await txn.runAsync('UPDATE sync_conflicts SET resolved_at = ? WHERE id = ?', [now, id]);
  });
  notifyChange([table, 'sync_conflicts']);
}
