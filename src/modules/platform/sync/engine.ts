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
 * 3. conflit (l'élément a changé ailleurs) : la modification la plus récente gagne, et la version
 *    qui perd est toujours gardée dans `sync_conflicts` (celle du téléphone ou celle de l'autre
 *    appareil) : rien n'est perdu en silence ;
 * 4. une ligne reçue impossible à enregistrer ici (contrainte, lien manquant) est mise de côté dans
 *    `sync_conflicts` sans bloquer le reste, puis réessayée à chaque synchronisation.
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
  | { mutation_id: string; status: 'rejected'; reason: string }
  | { mutation_id: string; status: 'conflict'; server: Record<string, unknown> };

/**
 * Position de lecture : `since` = dernier `server_updated_at` appliqué ; `afterId` = id de la dernière
 * ligne de la page précédente dans la même passe (page suivante), absent pour reprendre depuis le curseur
 * enregistré (avec une marge de relecture, voir remote.ts).
 */
export type PullCursor = { since: string; afterId: string | null };

/** Ce que le moteur attend du serveur (Supabase en vrai, un faux serveur dans les tests). */
export interface RemoteApi {
  push(mutations: Mutation[]): Promise<PushResult[]>;
  /** Lignes modifiées après le curseur, triées par (`server_updated_at`, `id`). */
  pull(
    table: SyncedTable,
    cursor: PullCursor | null,
    limit: number,
  ): Promise<Record<string, unknown>[]>;
}

export type SyncReport = {
  pushed: number;
  pulled: number;
  conflicts: number;
  skipped: number;
  /** Modifications refusées par le serveur (données invalides) : gardées dans `sync_conflicts`. */
  rejected: number;
  /** Lignes reçues impossibles à enregistrer ici : mises de côté dans `sync_conflicts`. */
  incomingRejected: number;
};

/**
 * Nature d'un conflit gardé dans `sync_conflicts` (colonne `kind`, migration 21) :
 * - `server_won` : la version du serveur a gagné, celle du téléphone est gardée ;
 * - `local_won` : celle du téléphone a gagné, celle de l'autre appareil (serveur) est gardée ;
 * - `rejected` : modification du téléphone refusée par le serveur ;
 * - `incoming_rejected` : ligne reçue du serveur impossible à enregistrer sur ce téléphone.
 */
export type ConflictKind = 'server_won' | 'local_won' | 'rejected' | 'incoming_rejected';

export type SyncOptions = {
  pageSize?: number;
  /**
   * Vérifiée avant chaque écriture dans la base : vrai = s'arrêter tout de suite (déconnexion,
   * effacement, restauration, téléphone qui n'appartient plus au compte). Lève `SyncStopped`.
   */
  shouldStop?: () => boolean | Promise<boolean>;
};

/** Synchronisation arrêtée exprès (voir `SyncOptions.shouldStop`) : pas une erreur à afficher. */
export class SyncStopped extends Error {
  constructor() {
    super('sync stopped');
    this.name = 'SyncStopped';
  }
}

async function stopIfAsked(options: SyncOptions): Promise<void> {
  if (options.shouldStop && (await options.shouldStop())) throw new SyncStopped();
}

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

/**
 * Une ligne en `pending_*` sans plus aucune entrée dans la file (modification refusée, ou mise de
 * côté puis ignorée) : on la remet à `synced` pour que la réception puisse de nouveau la mettre à
 * jour. Sa version reste la dernière version du serveur connue (celle sur laquelle elle était basée).
 */
export async function settleIfNothingPending(
  db: Db,
  table: SyncedTable,
  id: string,
): Promise<void> {
  const left = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM sync_outbox WHERE entity = ? AND entity_id = ?',
    [table, id],
  );
  if ((left?.n ?? 0) > 0) return;
  await db.runAsync(
    `UPDATE ${table} SET sync_status = 'synced' WHERE id = ? AND sync_status != 'synced'`,
    [id],
  );
}

async function enqueue(
  db: Db,
  table: SyncedTable,
  id: string,
  operation: 'create' | 'update' | 'delete',
  payload: Row,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_outbox (mutation_id, entity, entity_id, operation, payload, base_version, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), table, id, operation, JSON.stringify(payload), null, nowIso()],
  );
}

/**
 * Exceptions de cours : une seule ligne vivante par (série, date) (index unique, migration 16).
 * Deux appareils hors ligne ont pu en créer chacun une : la ligne au plus petit id est gardée
 * partout (règle identique sur chaque appareil), l'autre est supprimée logiquement via la file,
 * pour que le serveur l'apprenne aussi. Renvoie la ligne à écrire, et l'id à marquer supprimé.
 */
async function resolveExceptionDuplicate(
  db: Db,
  server: Record<string, unknown>,
): Promise<{ row: Record<string, unknown>; loser: string | null }> {
  if (server.deleted_at) return { row: server, loser: null };
  const id = String(server.id);
  const dup = await db.getFirstAsync<{ id: string }>(
    'SELECT id FROM course_exceptions WHERE series_id = ? AND date = ? AND deleted_at IS NULL AND id != ?',
    [String(server.series_id ?? ''), String(server.date ?? ''), id],
  );
  if (!dup) return { row: server, loser: null };
  const now = nowIso();
  const payload = { deleted_at: now, updated_at: now };
  if (dup.id < id) {
    await enqueue(db, 'course_exceptions', id, 'delete', payload);
    return { row: { ...server, ...payload }, loser: id };
  }
  await db.runAsync(
    `UPDATE course_exceptions SET deleted_at = ?, updated_at = ?, sync_status = 'pending_delete' WHERE id = ?`,
    [now, now, dup.id],
  );
  await enqueue(db, 'course_exceptions', dup.id, 'delete', payload);
  return { row: server, loser: null };
}

/** Écrit une ligne reçue du serveur dans la base du téléphone (sans passer par la file d'envoi). */
async function applyServerRow(
  db: Db,
  table: SyncedTable,
  received: Record<string, unknown>,
): Promise<void> {
  const { row: server, loser } =
    table === 'course_exceptions'
      ? await resolveExceptionDuplicate(db, received)
      : { row: received, loser: null };
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
  if (loser)
    await db.runAsync(`UPDATE ${table} SET sync_status = 'pending_delete' WHERE id = ?`, [loser]);
}

async function recordConflict(
  db: Db,
  table: SyncedTable,
  entityId: string,
  local: Record<string, unknown>,
  server: Record<string, unknown>,
  kind: ConflictKind,
) {
  await db.runAsync(
    `INSERT INTO sync_conflicts (id, entity, entity_id, local_payload, server_payload, created_at, kind)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [newId(), table, entityId, JSON.stringify(local), JSON.stringify(server), nowIso(), kind],
  );
}

/** Colonnes qui ne disent rien du contenu : ignorées pour savoir si deux versions diffèrent. */
const META_COLUMNS = new Set([
  'id',
  'version',
  'sync_status',
  'created_at',
  'updated_at',
  'server_updated_at',
  'user_id',
]);

function sameValue(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v);
  const x = norm(a);
  const y = norm(b);
  if (x === y) return true;
  if (x !== null && y !== null && (typeof x === 'object' || typeof y === 'object'))
    return (
      (typeof x === 'string' ? x : JSON.stringify(x)) ===
      (typeof y === 'string' ? y : JSON.stringify(y))
    );
  return false;
}

/** Mêmes valeurs métier des deux côtés (seules les colonnes connues du téléphone comptent). */
function sameContent(local: Row, server: Record<string, unknown>): boolean {
  for (const [k, v] of Object.entries(local)) {
    if (META_COLUMNS.has(k) || !(k in server)) continue;
    if (!sameValue(v, server[k])) return false;
  }
  return true;
}

/** Entrées de la file arrivées pendant l'envoi (élément modifié pendant l'aller-retour réseau). */
async function hasNewerEdits(db: Db, g: Group): Promise<boolean> {
  const rows = await db.getAllAsync<{ mutation_id: string }>(
    'SELECT mutation_id FROM sync_outbox WHERE entity = ? AND entity_id = ?',
    [g.entity, g.id],
  );
  const sent = new Set(g.ids);
  return rows.some((r) => !sent.has(r.mutation_id));
}

async function push(
  db: Db,
  remote: RemoteApi,
  report: SyncReport,
  changed: Set<string>,
  options: SyncOptions,
) {
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const groups = await buildGroups(db);
    if (groups.length === 0) return;
    let retry = false;
    for (let i = 0; i < groups.length; i += PUSH_BATCH) {
      const batch = groups.slice(i, i + PUSH_BATCH);
      const results = await remote.push(batch.map((g) => g.mutation));
      await stopIfAsked(options);
      const byId = new Map(results.map((r) => [r.mutation_id, r]));
      for (const g of batch) {
        const r = byId.get(g.mutation.mutation_id);
        if (!r) continue;
        if (r.status === 'applied') {
          await db.withExclusiveTransactionAsync((txn) => markSynced(txn, g, r.version));
          report.pushed++;
        } else if (r.status === 'missing') {
          // Absent du serveur : on le recrée à partir de la ligne locale complète.
          await db.runAsync(`UPDATE ${g.entity} SET sync_status = 'pending_create' WHERE id = ?`, [
            g.id,
          ]);
          await rewriteOutbox(db, g, 'create');
          retry = true;
        } else if (r.status === 'rejected') {
          // Le serveur refuse cette modification (contrainte violée…) : on la retire de la file pour
          // ne pas bloquer les autres, et on garde la ligne locale de côté avec la raison.
          await db.withExclusiveTransactionAsync(async (txn) => {
            const local = await localRow(txn, g.entity, g.id);
            if (local)
              await recordConflict(txn, g.entity, g.id, local, { reason: r.reason }, 'rejected');
            await deleteOutbox(txn, g.ids);
            // Plus rien à envoyer pour cette ligne : elle redevient « synchronisée » (sur la version
            // du serveur qu'elle connaît), sinon la réception la sauterait pour toujours.
            await settleIfNothingPending(txn, g.entity, g.id);
          });
          logger.warn('sync.rejected', { entity: g.entity, reason: r.reason });
          changed.add(g.entity);
          report.rejected++;
        } else {
          const server = r.server;
          let outcome = 'gone' as 'local' | 'server' | 'gone';
          // Décision et écriture dans une seule transaction, sur la ligne relue : une modification
          // faite pendant l'aller-retour réseau n'est jamais écrasée.
          await db.withExclusiveTransactionAsync(async (txn) => {
            const local = await localRow(txn, g.entity, g.id);
            if (!local) return;
            const localWins =
              (await hasNewerEdits(txn, g)) ||
              String(local.updated_at ?? '') >= String(server.updated_at ?? '');
            if (localWins) {
              // Notre modification gagne : on la renvoie sur la version du serveur, et la version
              // de l'autre appareil qu'elle remplace est gardée de côté (sauf si c'est la même).
              if (!sameContent(local, server))
                await recordConflict(txn, g.entity, g.id, local, server, 'local_won');
              await txn.runAsync(`UPDATE ${g.entity} SET version = ? WHERE id = ?`, [
                Number(server.version ?? 0),
                g.id,
              ]);
              await rewriteOutbox(txn, g, 'update');
              outcome = 'local';
              return;
            }
            // Celle du serveur est plus récente : elle gagne, la nôtre est gardée de côté.
            await recordConflict(txn, g.entity, g.id, local, server, 'server_won');
            await deleteOutbox(txn, g.ids);
            await applyServerRow(txn, g.entity, server);
            outcome = 'server';
          });
          if (outcome === 'gone') continue;
          changed.add(g.entity);
          report.conflicts++;
          if (outcome === 'local') retry = true;
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

/** Une page : au plus une ligne par id (la dernière reçue gagne), dans l'ordre du serveur. */
function dedupeById(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const byId = new Map<string, Record<string, unknown>>();
  for (const row of rows) byId.set(String(row.id), row);
  return [...byId.values()];
}

/** Remet une ligne dans l'état d'avant (ou la retire si elle n'existait pas), sans passer par la file. */
async function undoApplied(db: Db, table: SyncedTable, id: string, before: Row | null) {
  if (!before) {
    await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
    return;
  }
  const names = Object.keys(before).filter((k) => k !== 'id');
  await db.runAsync(`UPDATE ${table} SET ${names.map((n) => `${n} = ?`).join(', ')} WHERE id = ?`, [
    ...names.map((n) => before[n] ?? null),
    id,
  ]);
}

/**
 * Applique une page reçue dans une transaction. Chaque ligne a son point de sauvegarde : une ligne
 * refusée par la base (contrainte, lien vers un parent absent) est remise comme avant et mise de
 * côté (`incoming_rejected`), les autres sont enregistrées, et le curseur peut avancer.
 */
async function applyPage(
  txn: Db,
  table: SyncedTable,
  page: Record<string, unknown>[],
  report: SyncReport,
  changed: Set<string>,
  filesToDelete: string[],
): Promise<void> {
  // Un enfant peut arriver avant son parent : clés étrangères vérifiées à la fin de la page.
  await txn.execAsync('PRAGMA defer_foreign_keys = ON');
  const applied = new Map<string, { before: Row | null; row: Record<string, unknown> }>();
  const setAside = async (id: string, before: Row | null, row: Record<string, unknown>) => {
    // Déjà mise de côté (relecture avec marge, ou nouvelle version) : on garde la plus récente.
    const existing = await txn.getFirstAsync<{ id: string; server_payload: string }>(
      "SELECT id, server_payload FROM sync_conflicts WHERE kind = 'incoming_rejected' AND entity = ? AND entity_id = ? AND resolved_at IS NULL",
      [table, id],
    );
    if (existing) {
      if (Number(parsePayload(existing.server_payload).version ?? 0) >= Number(row.version ?? 0))
        return;
      await txn.runAsync(
        'UPDATE sync_conflicts SET server_payload = ?, created_at = ? WHERE id = ?',
        [JSON.stringify(row), nowIso(), existing.id],
      );
    } else await recordConflict(txn, table, id, before ?? { id }, row, 'incoming_rejected');
    report.incomingRejected++;
    changed.add(table);
    logger.warn('sync.incomingRejected', { entity: table });
  };
  for (const row of dedupeById(page)) {
    const id = String(row.id);
    const before = await localRow(txn, table, id);
    if (before && before.sync_status !== 'synced') {
      report.skipped++;
      continue;
    }
    // Déjà appliquée (relecture avec marge) : même version = même contenu.
    if (before && Number(before.version) === Number(row.version)) continue;
    await txn.execAsync('SAVEPOINT pull_row');
    try {
      await applyServerRow(txn, table, row);
      await txn.execAsync('RELEASE pull_row');
    } catch {
      await txn.execAsync('ROLLBACK TO pull_row');
      await txn.execAsync('RELEASE pull_row');
      await setAside(id, before, row);
      continue;
    }
    applied.set(id, { before, row });
  }
  // Liens vers un parent absent : ces lignes sont défaites une à une (défaire une ligne peut en
  // priver une autre de son parent, d'où la boucle) ; celles d'avant cette page ne sont pas touchées.
  for (let pass = 0; pass < 10 && applied.size > 0; pass++) {
    const violations = await txn.getAllAsync<{ rowid: number | null }>(
      `PRAGMA foreign_key_check(${table})`,
      [],
    );
    let undone = 0;
    for (const v of violations) {
      if (v.rowid === null) continue;
      const hit = await txn.getFirstAsync<{ id: string }>(
        `SELECT id FROM ${table} WHERE rowid = ?`,
        [v.rowid],
      );
      const entry = hit ? applied.get(hit.id) : undefined;
      if (!hit || !entry) continue;
      applied.delete(hit.id);
      await undoApplied(txn, table, hit.id, entry.before);
      await setAside(hit.id, entry.before, entry.row);
      undone++;
    }
    if (undone === 0) break;
  }
  const fileColumn = FILE_COLUMNS[table];
  for (const { before, row } of applied.values()) {
    report.pulled++;
    changed.add(table);
    // Supprimé ailleurs : le fichier local suivra (même garde que la synchro des fichiers).
    const path = fileColumn && row.deleted_at ? before?.[fileColumn] : null;
    if (typeof path === 'string' && path && !path.includes('..')) filesToDelete.push(path);
  }
}

/**
 * Lignes reçues mises de côté (`incoming_rejected`) : réessayées à chaque synchronisation, car un
 * parent arrivé depuis peut suffire. Enregistrée → le conflit disparaît ; le téléphone a déjà une
 * version égale ou plus récente → aussi ; sinon elle reste en attente.
 */
async function retryIncoming(db: Db, report: SyncReport, changed: Set<string>): Promise<void> {
  const waiting = await db.getAllAsync<{ id: string; entity: string; server_payload: string }>(
    "SELECT id, entity, server_payload FROM sync_conflicts WHERE kind = 'incoming_rejected' AND resolved_at IS NULL",
    [],
  );
  for (const c of waiting) {
    if (!isSynced(c.entity)) continue;
    const table = c.entity;
    const row = parsePayload(c.server_payload) as Record<string, unknown>;
    if (!row.id) continue;
    await db.withExclusiveTransactionAsync(async (txn) => {
      const local = await localRow(txn, table, String(row.id));
      // Modifications locales en attente : elles passeront par l'envoi et ses conflits.
      if (local && local.sync_status !== 'synced') return;
      const resolve = () =>
        txn.runAsync('UPDATE sync_conflicts SET resolved_at = ? WHERE id = ?', [nowIso(), c.id]);
      if (local && Number(local.version) >= Number(row.version)) {
        await resolve();
        return;
      }
      await txn.execAsync('SAVEPOINT retry_row');
      try {
        // Sans report des clés étrangères : un parent toujours absent fait échouer tout de suite.
        await applyServerRow(txn, table, row);
        await txn.execAsync('RELEASE retry_row');
      } catch {
        await txn.execAsync('ROLLBACK TO retry_row');
        await txn.execAsync('RELEASE retry_row');
        return;
      }
      await resolve();
      report.pulled++;
      changed.add(table);
    });
  }
}

async function pull(
  db: Db,
  remote: RemoteApi,
  report: SyncReport,
  changed: Set<string>,
  options: SyncOptions,
) {
  const pageSize = options.pageSize ?? PULL_PAGE;
  for (const table of SYNCED_TABLES) {
    const saved = await getSyncCursor(db, table);
    let cursor: PullCursor | null = saved ? { since: saved, afterId: null } : null;
    for (;;) {
      const page = await remote.pull(table, cursor, pageSize);
      if (page.length === 0) break;
      await stopIfAsked(options);
      const filesToDelete: string[] = [];
      await db.withExclusiveTransactionAsync((txn) =>
        applyPage(txn, table, page, report, changed, filesToDelete),
      );
      // Supprimé sur un autre appareil : le fichier n'a plus de raison de rester ici.
      for (const path of filesToDelete) {
        try {
          deleteLocalFile(path);
        } catch (e) {
          logger.error(e, { where: 'pull.deleteLocalFile' });
        }
      }
      const last = page[page.length - 1]!;
      cursor = { since: String(last.server_updated_at), afterId: String(last.id) };
      await setSyncCursor(db, table, cursor.since);
      if (page.length < pageSize) break;
    }
  }
}

/** Une synchronisation complète : envoi, puis réception. */
export async function syncOnce(
  db: Db,
  remote: RemoteApi,
  options: SyncOptions = {},
): Promise<SyncReport> {
  const report: SyncReport = {
    pushed: 0,
    pulled: 0,
    conflicts: 0,
    skipped: 0,
    rejected: 0,
    incomingRejected: 0,
  };
  const changed = new Set<string>();
  try {
    await stopIfAsked(options);
    // Une modification rejetée n'empêche pas la réception : le pull suit toujours le push.
    await push(db, remote, report, changed, options);
    await pull(db, remote, report, changed, options);
    await stopIfAsked(options);
    await retryIncoming(db, report, changed);
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

/** Ids des conflits encore à régler (pour repérer les nouveaux, pas seulement leur nombre). */
export async function conflictIds(db: Db): Promise<string[]> {
  const rows = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM sync_conflicts WHERE resolved_at IS NULL',
    [],
  );
  return rows.map((r) => r.id);
}

export async function conflictCount(db: Db): Promise<number> {
  const r = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM sync_conflicts WHERE resolved_at IS NULL',
    [],
  );
  return r?.n ?? 0;
}
