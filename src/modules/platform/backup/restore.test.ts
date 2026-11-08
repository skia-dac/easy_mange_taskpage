import { createSubject, listSubjects } from '@/modules/academic';
import { getSyncCursor, setSyncCursor } from '@/modules/identity';
import { createNote, listNotes } from '@/modules/productivity';
import { i18n } from '@/shared/i18n';
import { FakeServer } from '@/test/fakeServer';
import { createTestDb } from '@/test/memoryDb';

import { syncOnce } from '../sync/engine';
import { backupMessageKey, listBackups, readBackup, restoreBackup, writeBackup } from './files';
import { clearDatabase, createSnapshot, restoreSnapshot } from './snapshot';

/**
 * Système de fichiers en mémoire, à la place d'expo-file-system : le vrai chemin de restauration
 * (`writeBackup` → `listBackups` → `readBackup` → `restoreBackup`) tourne sur une vraie base SQLite.
 */
jest.mock('expo-file-system', () => {
  const files = new Map<string, string>();
  const join = (parts: unknown[]) =>
    parts
      .map((p) => (typeof p === 'string' ? p : (p as { uri: string }).uri))
      .join('/')
      .replace(/([^/:])\/{2,}/g, '$1/');
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    get name() {
      return this.uri.split('/').pop() ?? '';
    }
    get size() {
      return files.get(this.uri)?.length ?? null;
    }
    write(text: string) {
      files.set(this.uri, text);
    }
    async text() {
      const t = files.get(this.uri);
      if (t === undefined) throw new Error('ENOENT');
      return t;
    }
    delete() {
      files.delete(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = join(parts);
    }
    create() {}
    get exists() {
      return [...files.keys()].some((k) => k.startsWith(`${this.uri}/`));
    }
    list() {
      return [...files.keys()]
        .filter((k) => k.startsWith(`${this.uri}/`) && !k.slice(this.uri.length + 1).includes('/'))
        .map((k) => new File(k));
    }
    delete() {
      for (const k of [...files.keys()]) if (k.startsWith(`${this.uri}/`)) files.delete(k);
    }
  }
  return {
    File,
    Directory,
    Paths: { document: 'file:///doc', cache: 'file:///cache' },
    __files: files,
  };
});
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('expo-document-picker', () => ({ getDocumentAsync: jest.fn() }));

const fakeFiles = (jest.requireMock('expo-file-system') as { __files: Map<string, string> })
  .__files;

beforeEach(() => fakeFiles.clear());

describe('restauration d’une sauvegarde, de bout en bout', () => {
  it('sauvegarde → tout effacé → restauration : les données reviennent', async () => {
    const db = await createTestDb();
    const subjectId = await createSubject(db, { name: 'Maths', colorId: 'blue' });
    await createNote(db, { title: 'Chapitre 1', content: 'Dérivées', subjectId });

    const written = await writeBackup(db, new Date('2026-11-08T10:00:00.000Z'));
    expect(listBackups().map((b) => b.name)).toEqual([written.name]);

    await clearDatabase(db);
    expect(await listSubjects(db)).toHaveLength(0);
    expect(await listNotes(db)).toHaveLength(0);

    const [latest] = listBackups();
    const snapshot = await readBackup(db, latest!.uri);
    await restoreBackup(db, snapshot);
    expect((await listSubjects(db)).map((s) => s.name)).toEqual(['Maths']);
    expect((await listNotes(db)).map((n) => n.title)).toEqual(['Chapitre 1']);
    db.close();
  });

  it.each([
    ['un fichier abîmé', '{"format":"mysky-backup","version":1,"tab'],
    ['le fichier d’une autre app', JSON.stringify({ app: 'autre', items: [1, 2, 3] })],
    [
      'une sauvegarde au mauvais format',
      JSON.stringify({ format: 'mysky-backup', version: 1, tables: 'x' }),
    ],
  ])('refuse %s avec un message clair, sans rien changer', async (_label, content) => {
    const db = await createTestDb();
    await createSubject(db, { name: 'Gardée', colorId: 'blue' });
    fakeFiles.set('file:///cache/picked.json', content);

    const error = await readBackup(db, 'file:///cache/picked.json').catch((e: unknown) => e);
    expect(backupMessageKey(error)).toBe('backup.unreadable');
    // Un vrai texte traduit, sans détail technique.
    const message = i18n.t(backupMessageKey(error));
    expect(message).not.toBe('backup.unreadable');
    expect(message).not.toMatch(/json|syntax|zod|undefined|ENOENT/i);
    expect((await listSubjects(db)).map((s) => s.name)).toEqual(['Gardée']);
    db.close();
  });

  it('un fichier introuvable est refusé avec le même message clair', async () => {
    const db = await createTestDb();
    const error = await readBackup(db, 'file:///cache/absent.json').catch((e: unknown) => e);
    expect(backupMessageKey(error)).toBe('backup.unreadable');
    db.close();
  });

  it('une sauvegarde d’une version plus récente demande de mettre l’app à jour', async () => {
    const db = await createTestDb();
    const future = { ...(await createSnapshot(db)), schemaVersion: 999 };
    fakeFiles.set('file:///cache/future.json', JSON.stringify(future));
    const error = await readBackup(db, 'file:///cache/future.json').catch((e: unknown) => e);
    expect(backupMessageKey(error)).toBe('backup.tooRecent');
    db.close();
  });
});

describe('restauration et curseurs de synchronisation', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-11-08T08:00:00.000Z') }));
  afterEach(() => jest.useRealTimers());

  it('ne restaure pas les curseurs de réception : la synchro suivante relit tout', async () => {
    const db = await createTestDb();
    await setSyncCursor(db, 'notes', '2030-01-01T00:00:00.000Z');
    const snapshot = await createSnapshot(db);
    expect(snapshot.tables.app_settings!.some((r) => r.key === 'sync_cursor:notes')).toBe(true);

    await restoreSnapshot(db, snapshot);
    expect(await getSyncCursor(db, 'notes')).toBeNull();
    db.close();
  });

  it('connecté : après restauration, ce qui est sur le compte revient même si la sauvegarde ne l’a pas', async () => {
    const server = new FakeServer();
    const phone = await createTestDb();
    const subjectId = await createSubject(phone, { name: 'Maths', colorId: 'blue' });
    server.fixedStamp = '2030-01-01T00:00:00.000Z';
    await createNote(phone, { title: 'Sur le compte', content: '', subjectId });
    await syncOnce(phone, server.remote());
    // Un mois plus tard, une autre note : le curseur des notes avance bien au-delà de la première.
    server.fixedStamp = '2030-02-01T00:00:00.000Z';
    jest.setSystemTime(new Date('2026-12-08T08:00:00.000Z'));
    await createNote(phone, { title: 'Plus récente', content: '', subjectId });
    await syncOnce(phone, server.remote());
    expect(await getSyncCursor(phone, 'notes')).toBe('2030-02-01T00:00:00.000Z');

    // Sauvegarde incomplète (ancienne version, fichier partiel) : la table des notes manque,
    // mais le curseur des notes est déjà au-delà de la note.
    const snapshot = await createSnapshot(phone);
    const partial = { ...snapshot, tables: { ...snapshot.tables } };
    delete partial.tables.notes;
    await restoreSnapshot(phone, partial);
    expect(await listNotes(phone)).toHaveLength(0);

    // Avec l'ancien curseur, la première note ne serait jamais redemandée ; remis à zéro, tout revient.
    await syncOnce(phone, server.remote());
    expect((await listNotes(phone)).map((n) => n.title).sort()).toEqual([
      'Plus récente',
      'Sur le compte',
    ]);
    expect((await listSubjects(phone)).map((s) => s.name)).toEqual(['Maths']);
    phone.close();
  });

  it('connecté : une sauvegarde complète restaurée reçoit aussi les changements faits depuis', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const subjectId = await createSubject(a, { name: 'Maths', colorId: 'blue' });
    await syncOnce(a, server.remote());
    const snapshot = await createSnapshot(a);

    await syncOnce(b, server.remote());
    jest.setSystemTime(new Date('2026-11-08T09:00:00.000Z'));
    await createNote(b, { title: 'Faite sur B', content: '', subjectId });
    await syncOnce(b, server.remote());
    await syncOnce(a, server.remote());

    await restoreSnapshot(a, snapshot);
    expect(await listNotes(a)).toHaveLength(0);
    const report = await syncOnce(a, server.remote());
    expect((await listNotes(a)).map((n) => n.title)).toEqual(['Faite sur B']);
    // Rien de ce que A avait déjà n'est renvoyé, ni appliqué deux fois.
    expect(report.pushed).toBe(0);
    expect(server.rows('subjects')).toHaveLength(1);
    a.close();
    b.close();
  });
});
