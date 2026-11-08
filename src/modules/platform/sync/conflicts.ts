import { newId, notifyChange, nowIso, SYNCED_TABLES, type Db, type SqlValue } from '@/shared/db';
import { AppError } from '@/shared/errors';

import { settleIfNothingPending, type ConflictKind, type SyncedTable } from './engine';

/**
 * Conflits gardés de côté par la synchronisation (`sync_conflicts`), selon `kind` :
 * - `server_won` : la version du téléphone a été remplacée par celle d'un autre appareil ;
 * - `local_won` : la version du téléphone a remplacé celle d'un autre appareil ;
 * - `rejected` : modification du téléphone refusée par le serveur ;
 * - `incoming_rejected` : modification d'un autre appareil impossible à enregistrer ici.
 * L'utilisateur peut reprendre la version qui a perdu (elle repart par la file d'envoi) ou l'ignorer.
 * `local` est toujours la version du téléphone, `server` celle de l'autre appareil.
 */
export type SyncConflict = {
  id: string;
  kind: ConflictKind;
  entity: string;
  entityId: string;
  /** Titre lisible de l'élément, si sa ligne en a un (titre, nom, personne…). */
  title: string | null;
  /** Raison donnée par le serveur quand la modification a été refusée (technique, jamais affichée). */
  reason: string | null;
  /** Motif lisible d'un refus (clé `conflicts.rejection.<motif>`), null si ce n'est pas un refus. */
  rejection: RejectionKind | null;
  createdAt: string;
  local: Record<string, SqlValue>;
  /** Version de l'autre appareil (serveur) ; null pour un refus (le serveur n'a rien gardé). */
  server: Record<string, SqlValue> | null;
};

/** Comment afficher la valeur d'un champ clé (l'écran formate selon la langue). */
export type ConflictFieldType = 'text' | 'date' | 'time' | 'money' | 'deleted';

/** Un champ clé de l'élément, côte à côte : ta version (ce téléphone) et celle du serveur. */
export type ConflictField = {
  column: string;
  type: ConflictFieldType;
  local: SqlValue;
  server: SqlValue;
  /** Devise des montants (`money`), lue dans la version correspondante. */
  localCurrency: string | null;
  serverCurrency: string | null;
  differs: boolean;
};

type ConflictRow = {
  id: string;
  kind: string;
  entity: string;
  entity_id: string;
  local_payload: string;
  server_payload: string;
  created_at: string;
};

export const rejectionKinds = [
  'missingField',
  'invalidValue',
  'missingLink',
  'duplicate',
  'other',
] as const;
export type RejectionKind = (typeof rejectionKinds)[number];

/** Classe la raison technique du serveur (message Postgres) en un motif affichable. */
export function rejectionKindOf(reason: string): RejectionKind {
  const r = reason.toLowerCase();
  if (r.includes('not-null') || r.includes('not null') || r.includes('null value'))
    return 'missingField';
  if (r.includes('foreign key')) return 'missingLink';
  if (r.includes('unique') || r.includes('duplicate')) return 'duplicate';
  if (r.includes('check') || r.includes('invalid') || r.includes('out of range'))
    return 'invalidValue';
  return 'other';
}

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

const KINDS: readonly ConflictKind[] = ['server_won', 'local_won', 'rejected', 'incoming_rejected'];

function kindOf(row: Pick<ConflictRow, 'kind'>): ConflictKind {
  return (KINDS as readonly string[]).includes(row.kind)
    ? (row.kind as ConflictKind)
    : 'server_won';
}

/** Raison technique d'un refus du serveur (seulement pour `rejected`). */
function listReason(row: Pick<ConflictRow, 'server_payload' | 'kind'>): string | null {
  if (kindOf(row) !== 'rejected') return null;
  const reason = parse(row.server_payload).reason;
  return typeof reason === 'string' ? reason : 'other';
}

/**
 * Champs clés montrés pour comparer, dans l'ordre : ce que l'utilisateur reconnaît (titre, date,
 * montant…). Seuls ceux présents dans l'une des deux versions apparaissent.
 */
const KEY_FIELDS: readonly { column: string; type: ConflictFieldType }[] = [
  { column: 'deleted_at', type: 'deleted' },
  { column: 'title', type: 'text' },
  { column: 'name', type: 'text' },
  { column: 'person', type: 'text' },
  { column: 'first_name', type: 'text' },
  { column: 'last_name', type: 'text' },
  { column: 'date', type: 'date' },
  { column: 'due_date', type: 'date' },
  { column: 'due_time', type: 'time' },
  { column: 'time', type: 'time' },
  { column: 'start_time', type: 'time' },
  { column: 'end_time', type: 'time' },
  { column: 'amount_minor', type: 'money' },
  { column: 'target_minor', type: 'money' },
  { column: 'status', type: 'text' },
  { column: 'room', type: 'text' },
  { column: 'content', type: 'text' },
  { column: 'description', type: 'text' },
  { column: 'note', type: 'text' },
];

/** Texte long (contenu d'une note) : un aperçu suffit pour reconnaître la version. */
export const CONFLICT_PREVIEW = 80;

function shown(v: SqlValue | undefined, type: ConflictFieldType): SqlValue {
  if (v === undefined || v === '') return null;
  if (type === 'text' && typeof v === 'string' && v.length > CONFLICT_PREVIEW)
    return `${v.slice(0, CONFLICT_PREVIEW).trimEnd()}…`;
  return v;
}

/** Les champs clés des deux versions d'un conflit, pour les comparer avant de choisir. */
export function conflictFields(conflict: Pick<SyncConflict, 'local' | 'server'>): ConflictField[] {
  const { local, server } = conflict;
  const currency = (row: Record<string, SqlValue> | null) =>
    row && typeof row.currency === 'string' ? row.currency : null;
  const out: ConflictField[] = [];
  for (const { column, type } of KEY_FIELDS) {
    const l = shown(local[column], type);
    const s = server ? shown(server[column], type) : null;
    // Toujours montrer « supprimé » s'il l'est d'un côté ; sinon seulement les champs remplis.
    if (l === null && s === null) continue;
    out.push({
      column,
      type,
      local: l,
      server: s,
      localCurrency: currency(local),
      serverCurrency: currency(server),
      differs: server !== null && l !== s,
    });
  }
  return out;
}

const isSynced = (t: string): t is SyncedTable => (SYNCED_TABLES as readonly string[]).includes(t);

/** Conflits non résolus, les plus récents d'abord. */
export async function listConflicts(db: Db): Promise<SyncConflict[]> {
  const rows = await db.getAllAsync<ConflictRow>(
    'SELECT * FROM sync_conflicts WHERE resolved_at IS NULL ORDER BY created_at DESC, rowid DESC',
    [],
  );
  return rows.map((r) => {
    const kind = kindOf(r);
    const local = parse(r.local_payload);
    const reason = listReason(r);
    const server = kind === 'rejected' ? null : parse(r.server_payload);
    return {
      id: r.id,
      kind,
      entity: r.entity,
      entityId: r.entity_id,
      title: titleOf(kind === 'incoming_rejected' && server ? server : local) ?? titleOf(local),
      reason,
      rejection: reason === null ? null : rejectionKindOf(reason),
      createdAt: r.created_at,
      local,
      server,
    };
  });
}

/**
 * « Ignorer » : la version du serveur reste, le conflit est marqué résolu. Si la ligne est encore
 * marquée « à envoyer » sans plus rien dans la file (refus), elle redevient synchronisée pour que
 * les modifications des autres appareils puissent l'atteindre.
 */
export async function ignoreConflict(db: Db, id: string): Promise<void> {
  const row = await db.getFirstAsync<Pick<ConflictRow, 'entity' | 'entity_id'>>(
    'SELECT entity, entity_id FROM sync_conflicts WHERE id = ?',
    [id],
  );
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('UPDATE sync_conflicts SET resolved_at = ? WHERE id = ?', [nowIso(), id]);
    if (row && isSynced(row.entity)) await settleIfNothingPending(txn, row.entity, row.entity_id);
  });
  notifyChange(row && isSynced(row.entity) ? [row.entity, 'sync_conflicts'] : ['sync_conflicts']);
}

/**
 * Une modification refusée (par le serveur ou par ce téléphone) ne se renvoie pas telle quelle :
 * elle serait refusée encore. Seuls les deux cas où une version a gagné se restaurent.
 */
export function canRestore(conflict: Pick<SyncConflict, 'kind'>): boolean {
  return conflict.kind === 'server_won' || conflict.kind === 'local_won';
}

/**
 * « Restaurer » : la ligne locale est réécrite avec la version qui avait perdu — celle du téléphone
 * (`server_won`) ou celle de l'autre appareil (`local_won`) — et repart par la file d'envoi (comme
 * toute modification faite sur le téléphone). Si la ligne a disparu entre-temps, elle est recréée.
 */
export async function restoreConflict(db: Db, id: string): Promise<void> {
  const row = await db.getFirstAsync<ConflictRow>('SELECT * FROM sync_conflicts WHERE id = ?', [
    id,
  ]);
  if (!row) return;
  const kind = kindOf(row);
  if (!canRestore({ kind }))
    throw new AppError('validation', 'rejectedConflict', {
      messageKey: 'conflicts.rejectedCannotRestore',
    });
  const table = row.entity;
  const local = parse(kind === 'local_won' ? row.server_payload : row.local_payload);
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
      if (!cols.has(k) || NOT_RESTORED.has(k)) continue;
      // Version venue du serveur (JSON) : booléens et objets ramenés à des valeurs SQLite.
      const raw: unknown = v;
      values[k] =
        typeof raw === 'boolean'
          ? raw
            ? 1
            : 0
          : raw !== null && typeof raw === 'object'
            ? JSON.stringify(raw)
            : v;
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
