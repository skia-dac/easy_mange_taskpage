import type { MigratableDatabase } from './migrate';
import { DEDUPE_ALIVE_COURSE_EXCEPTIONS } from './migrations';

/** Colonnes ajoutées par une migration publiée, à retrouver si la base dit l'avoir passée. */
const REQUIRED_COLUMNS: readonly { since: number; table: string; column: string; sql: string }[] = [
  {
    since: 18,
    table: 'tasks',
    column: 'repeat_parent_id',
    sql: `ALTER TABLE tasks ADD COLUMN repeat_parent_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_tasks_repeat_parent ON tasks (repeat_parent_id);`,
  },
  {
    since: 18,
    table: 'assignments',
    column: 'repeat_parent_id',
    sql: `ALTER TABLE assignments ADD COLUMN repeat_parent_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_assignments_repeat_parent ON assignments (repeat_parent_id);`,
  },
];

/**
 * Répare une base dont le numéro de version ne correspond pas à son contenu : un téléphone qui a
 * fait tourner une version de développement avec d'autres migrations 18+ croit les avoir passées,
 * sans les colonnes de cette version-ci (« no such column: repeat_parent_id » au démarrage).
 * À lancer avant `migrate` : on remet seulement ce qui manque, sans rien supprimer.
 * Sans effet sur une base normale.
 */
export async function repairDivergentSchema(db: MigratableDatabase): Promise<string[]> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []);
  const version = row?.user_version ?? 0;
  const repaired: string[] = [];
  if (version < 18) return repaired;

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const r of REQUIRED_COLUMNS) {
      if (version < r.since) continue;
      const table = await txn.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = ?",
        [r.table],
      );
      if (!table?.n) continue;
      const col = await txn.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM pragma_table_info('${r.table}') WHERE name = ?`,
        [r.column],
      );
      if (col?.n) continue;
      await txn.execAsync(r.sql);
      repaired.push(`${r.table}.${r.column}`);
    }
    if (version >= 19) {
      const idx = await txn.getFirstAsync<{ n: number }>(
        "SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index' AND name = ?",
        ['idx_course_exceptions_series_date_alive'],
      );
      if (!idx?.n) {
        await txn.execAsync(`${DEDUPE_ALIVE_COURSE_EXCEPTIONS}
          CREATE UNIQUE INDEX IF NOT EXISTS idx_course_exceptions_series_date_alive
            ON course_exceptions (series_id, date) WHERE deleted_at IS NULL;`);
        repaired.push('course_exceptions.unique_alive');
      }
    }
  });
  return repaired;
}
