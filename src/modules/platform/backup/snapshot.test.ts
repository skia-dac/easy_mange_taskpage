import { createSubject, listSubjects } from '@/modules/academic';
import { getWeekStart, setWeekStart } from '@/modules/identity';
import { createNote, listNotes } from '@/modules/productivity';
import { createTestDb } from '@/test/memoryDb';

import {
  BACKUP_TABLES,
  clearDatabase,
  createSnapshot,
  parseSnapshot,
  restoreSnapshot,
  snapshotSummary,
} from './snapshot';

describe('sauvegarde locale', () => {
  it('liste toutes les tables de la base', async () => {
    const db = await createTestDb();
    const rows = await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      [],
    );
    expect([...BACKUP_TABLES].sort()).toEqual(rows.map((r) => r.name).sort());
    db.close();
  });

  it('fait le tour complet : sauvegarde → base vidée → restauration', async () => {
    const db = await createTestDb();
    const subjectId = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    await createNote(db, { title: 'Chapitre 1', content: 'Dérivées', subjectId });
    await setWeekStart(db, 7);

    const snapshot = await createSnapshot(db);
    expect(snapshotSummary(snapshot).items).toBe(2);
    const text = JSON.stringify(snapshot);

    await clearDatabase(db);
    expect(await listSubjects(db)).toHaveLength(0);
    expect(await getWeekStart(db)).toBe(1);

    await restoreSnapshot(db, await parseSnapshot(db, text));
    const subjects = await listSubjects(db);
    expect(subjects.map((s) => s.name)).toEqual(['Maths']);
    expect((await listNotes(db)).map((n) => n.title)).toEqual(['Chapitre 1']);
    expect(await getWeekStart(db)).toBe(7);
    db.close();
  });

  it('refuse un fichier qui n’est pas une sauvegarde, ou trop récent', async () => {
    const db = await createTestDb();
    await expect(parseSnapshot(db, 'pas du json')).rejects.toThrow('backupUnreadable');
    await expect(parseSnapshot(db, '{"format":"autre"}')).rejects.toThrow('backupUnreadable');
    const future = { ...(await createSnapshot(db)), schemaVersion: 999 };
    await expect(parseSnapshot(db, JSON.stringify(future))).rejects.toThrow('backupTooRecent');
    db.close();
  });

  it('ignore les colonnes inconnues et ne laisse rien à moitié fait en cas d’erreur', async () => {
    const db = await createTestDb();
    const keptId = await createSubject(db, { name: 'Gardée', colorId: 'blue' });
    const snapshot = await createSnapshot(db);
    const withExtra = {
      ...snapshot,
      tables: {
        ...snapshot.tables,
        subjects: snapshot.tables.subjects!.map((s) => ({ ...s, name: 'Restaurée', bidule: 1 })),
      },
    };
    await restoreSnapshot(db, withExtra);
    expect((await listSubjects(db)).map((s) => s.name)).toEqual(['Restaurée']);

    // Une note qui pointe vers une matière inexistante viole la clé étrangère : rien ne change.
    const broken = {
      ...snapshot,
      tables: {
        ...snapshot.tables,
        notes: [{ ...(await createSnapshot(db)).tables.subjects![0]!, id: 'n1', subject_id: 'x' }],
      },
    };
    await expect(restoreSnapshot(db, broken)).rejects.toThrow();
    expect((await listSubjects(db)).map((s) => s.id)).toEqual([keptId]);
    db.close();
  });
});
