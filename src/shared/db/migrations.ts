import type { Migration } from './migrate';

/**
 * Colonnes communes à toutes les données synchronisées (architecture §7.2).
 * À utiliser dans chaque table métier (matières, cours, notes…) à partir de la phase 1.
 */
export const SYNC_COLUMNS = `
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  version INTEGER NOT NULL DEFAULT 0,
  sync_status TEXT NOT NULL DEFAULT 'pending_create'
    CHECK (sync_status IN ('synced', 'pending_create', 'pending_update', 'pending_delete', 'conflict'))
`;

/**
 * Liste des migrations. Règles :
 * - ne JAMAIS modifier une migration déjà publiée : en ajouter une nouvelle à la fin ;
 * - les numéros se suivent (1, 2, 3…), un test le vérifie.
 */
export const migrations: readonly Migration[] = [
  {
    version: 1,
    name: 'socle : réglages et file de synchronisation',
    sql: `
      CREATE TABLE app_settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE sync_outbox (
        mutation_id TEXT PRIMARY KEY NOT NULL,
        entity TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
        payload TEXT NOT NULL,
        base_version INTEGER,
        created_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );

      CREATE INDEX idx_sync_outbox_created_at ON sync_outbox (created_at);
    `,
  },
];
