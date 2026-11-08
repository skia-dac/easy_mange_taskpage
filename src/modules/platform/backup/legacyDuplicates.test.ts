import { createCourse, createSubject } from '@/modules/academic';
import { createSnapshot, restoreSnapshot } from './snapshot';
import { migrate, migrationPreparations, migrations, type Db } from '@/shared/db';
import { createTestDb } from '@/test/memoryDb';

/**
 * Doublons vivants d'exceptions de cours (même série, même date) : la migration 16 crée un index
 * unique dessus. Une base qui en a ne doit pas bloquer le démarrage, ni la restauration d'une
 * ancienne sauvegarde.
 */

async function seedDuplicates(db: Db) {
  const subjectId = await createSubject(db, { name: 'Maths', colorId: 'blue' });
  const seriesId = await createCourse(db, {
    subjectId,
    courseType: 'lecture',
    recurrence: 'weekly',
    weekday: 1,
    startDate: '2026-09-07',
    endDate: '2026-12-14',
    startTime: '08:00',
    endTime: '10:00',
  });
  for (const id of ['exc-b', 'exc-a', 'exc-c']) {
    await db.runAsync(
      `INSERT INTO course_exceptions (id, created_at, updated_at, version, sync_status, series_id, date, kind)
       VALUES (?, 'x', 'x', 1, 'synced', ?, '2026-09-14', 'cancelled')`,
      [id, seriesId],
    );
  }
  return seriesId;
}

async function alive(db: Db) {
  return (
    await db.getAllAsync<{ id: string }>(
      'SELECT id FROM course_exceptions WHERE deleted_at IS NULL ORDER BY id',
      [],
    )
  ).map((r) => r.id);
}

describe('exceptions de cours en double', () => {
  it('une base v15 avec des doublons migre jusqu’au bout (plus petit id gardé, suppression envoyée)', async () => {
    const db = await createTestDb(15);
    await seedDuplicates(db);

    // Sans la préparation, la v16 (publiée, inchangée) échouerait et l'app ne démarrerait pas.
    await expect(migrate(db, migrations)).rejects.toThrow(/UNIQUE/);
    expect(
      (await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version', []))?.user_version,
    ).toBe(15);

    await expect(migrate(db, migrations, migrationPreparations)).resolves.toBe(migrations.length);
    expect(await alive(db)).toEqual(['exc-a']);
    const losers = await db.getAllAsync<{ id: string; sync_status: string }>(
      'SELECT id, sync_status FROM course_exceptions WHERE deleted_at IS NOT NULL ORDER BY id',
      [],
    );
    expect(losers).toEqual([
      { id: 'exc-b', sync_status: 'pending_delete' },
      { id: 'exc-c', sync_status: 'pending_delete' },
    ]);
    const outbox = await db.getAllAsync<{ entity_id: string; operation: string; payload: string }>(
      "SELECT entity_id, operation, payload FROM sync_outbox WHERE entity = 'course_exceptions' ORDER BY entity_id",
      [],
    );
    expect(outbox.map((o) => [o.entity_id, o.operation])).toEqual([
      ['exc-b', 'delete'],
      ['exc-c', 'delete'],
    ]);
    expect(JSON.parse(outbox[0]!.payload).deleted_at).toMatch(/^\d{4}-\d\d-\d\dT.*Z$/);
    db.close();
  });

  it('restaurer une sauvegarde d’avant la v16 qui a des doublons fonctionne', async () => {
    const old = await createTestDb(15);
    await seedDuplicates(old);
    const snapshot = await createSnapshot(old);
    old.close();

    const db = await createTestDb();
    await restoreSnapshot(db, snapshot);
    expect(await alive(db)).toEqual(['exc-a']);
    const pending = await db.getAllAsync<{ entity_id: string; operation: string }>(
      "SELECT entity_id, operation FROM sync_outbox WHERE entity = 'course_exceptions' ORDER BY entity_id",
      [],
    );
    // Restaurer renvoie chaque élément ; les doublons partent comme suppressions.
    expect(pending).toEqual([
      { entity_id: 'exc-a', operation: 'update' },
      { entity_id: 'exc-b', operation: 'delete' },
      { entity_id: 'exc-c', operation: 'delete' },
    ]);
    db.close();
  });
});
