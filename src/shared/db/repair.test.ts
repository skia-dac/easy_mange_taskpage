import { createTestDb } from '@/test/memoryDb';

import { migrate } from './migrate';
import { migrationPreparations, migrations } from './migrations';
import { repairDivergentSchema } from './repair';

const hasColumn = async (
  db: Awaited<ReturnType<typeof createTestDb>>,
  table: string,
  column: string,
) =>
  ((
    await db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM pragma_table_info('${table}') WHERE name = ?`,
      [column],
    )
  )?.n ?? 0) > 0;

describe('repairDivergentSchema', () => {
  it('base de développement « en version 19 » sans repeat_parent_id : réparée, puis migrée', async () => {
    // Base créée jusqu'à la 17, puis marquée 19 par une autre version de l'app.
    const db = await createTestDb(17);
    await db.execAsync('PRAGMA user_version = 19');
    await db.runAsync(
      `INSERT INTO tasks (id, created_at, updated_at, version, sync_status, title, due_date, priority, status)
       VALUES ('t1', '2026-01-01', '2026-01-01', 1, 'synced', 'Lire', '2026-01-02', 'normal', 'todo')`,
      [],
    );
    // Sans réparation, la migration 20 échoue comme sur le téléphone.
    await expect(migrate(db, migrations, migrationPreparations)).rejects.toThrow(
      /repeat_parent_id/,
    );

    const repaired = await repairDivergentSchema(db);
    expect(repaired).toEqual(
      expect.arrayContaining(['tasks.repeat_parent_id', 'assignments.repeat_parent_id']),
    );
    await expect(migrate(db, migrations, migrationPreparations)).resolves.toBe(migrations.length);
    expect(await hasColumn(db, 'tasks', 'repeat_parent_id')).toBe(true);
    const task = await db.getFirstAsync<{ title: string }>(
      "SELECT title FROM tasks WHERE id = 't1'",
      [],
    );
    expect(task?.title).toBe('Lire');
    db.close();
  });

  it('base normale : rien à réparer', async () => {
    const db = await createTestDb();
    expect(await repairDivergentSchema(db)).toEqual([]);
    db.close();
  });

  it('base plus ancienne que la 18 : laissée aux migrations', async () => {
    const db = await createTestDb(15);
    expect(await repairDivergentSchema(db)).toEqual([]);
    expect(await hasColumn(db, 'tasks', 'repeat_parent_id')).toBe(false);
    db.close();
  });
});
