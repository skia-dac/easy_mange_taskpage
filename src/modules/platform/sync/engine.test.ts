import { createSubject, listSubjects, updateSubject } from '@/modules/academic';
import { createNote, deleteNote, listNotes } from '@/modules/productivity';
import { FakeServer } from '@/test/fakeServer';
import { createTestDb } from '@/test/memoryDb';

import { conflictCount, pendingCount, syncOnce } from './engine';

const subject = { name: 'Maths', colorId: 'blue' };

describe('synchronisation', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-09-24T08:00:00.000Z') }));
  afterEach(() => jest.useRealTimers());

  it('envoie les données d’un téléphone et les retrouve sur un autre', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const id = await createSubject(a, subject);
    await createNote(a, { title: 'Chapitre 1', content: 'Dérivées', subjectId: id });
    expect(await pendingCount(a)).toBe(2);

    const ra = await syncOnce(a, server.remote());
    expect(ra.pushed).toBe(2);
    expect(await pendingCount(a)).toBe(0);
    expect(server.rows('subjects')[0]).toMatchObject({ id, name: 'Maths', version: 1 });
    const local = await a.getFirstAsync<{ sync_status: string; version: number }>(
      'SELECT sync_status, version FROM subjects WHERE id = ?',
      [id],
    );
    expect(local).toEqual({ sync_status: 'synced', version: 1 });

    const rb = await syncOnce(b, server.remote());
    expect(rb.pulled).toBe(2);
    expect((await listSubjects(b)).map((s) => s.name)).toEqual(['Maths']);
    expect((await listNotes(b)).map((n) => n.title)).toEqual(['Chapitre 1']);
    // Rien n'est renvoyé par B : ce qu'il a reçu n'est pas une modification locale.
    expect(await pendingCount(b)).toBe(0);
    a.close();
    b.close();
  });

  it('fait suivre les modifications et les suppressions', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const id = await createSubject(a, subject);
    const note = await createNote(a, { title: 'À supprimer', content: '' });
    await syncOnce(a, server.remote());
    await syncOnce(b, server.remote());

    jest.setSystemTime(new Date('2026-09-24T09:00:00.000Z'));
    await updateSubject(b, id, { ...subject, name: 'Mathématiques' });
    await deleteNote(b, note);
    await syncOnce(b, server.remote());
    await syncOnce(a, server.remote());
    expect((await listSubjects(a)).map((s) => s.name)).toEqual(['Mathématiques']);
    expect(await listNotes(a)).toEqual([]);
    expect(server.rows('subjects')[0]?.version).toBe(2);
    a.close();
    b.close();
  });

  it('conflit : la modification la plus récente gagne, l’autre est gardée de côté', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const id = await createSubject(a, subject);
    await syncOnce(a, server.remote());
    await syncOnce(b, server.remote());

    // A modifie à 9 h (hors ligne), B à 10 h ; B synchronise d'abord.
    jest.setSystemTime(new Date('2026-09-24T09:00:00.000Z'));
    await updateSubject(a, id, { ...subject, name: 'Version A' });
    jest.setSystemTime(new Date('2026-09-24T10:00:00.000Z'));
    await updateSubject(b, id, { ...subject, name: 'Version B' });
    await syncOnce(b, server.remote());

    const ra = await syncOnce(a, server.remote());
    expect(ra.conflicts).toBe(1);
    expect((await listSubjects(a)).map((s) => s.name)).toEqual(['Version B']);
    expect(await conflictCount(a)).toBe(1);
    const kept = await a.getFirstAsync<{ local_payload: string }>(
      'SELECT local_payload FROM sync_conflicts',
      [],
    );
    expect(JSON.parse(kept!.local_payload).name).toBe('Version A');
    expect(await pendingCount(a)).toBe(0);
    a.close();
    b.close();
  });

  it('conflit : si la modification locale est plus récente, elle est renvoyée et gagne', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const id = await createSubject(a, subject);
    await syncOnce(a, server.remote());
    await syncOnce(b, server.remote());

    jest.setSystemTime(new Date('2026-09-24T09:00:00.000Z'));
    await updateSubject(b, id, { ...subject, name: 'Version B' });
    await syncOnce(b, server.remote());
    jest.setSystemTime(new Date('2026-09-24T10:00:00.000Z'));
    await updateSubject(a, id, { ...subject, name: 'Version A' });

    const ra = await syncOnce(a, server.remote());
    expect(ra.conflicts).toBe(0);
    expect(server.rows('subjects')[0]).toMatchObject({ name: 'Version A', version: 3 });
    await syncOnce(b, server.remote());
    expect((await listSubjects(b)).map((s) => s.name)).toEqual(['Version A']);
    a.close();
    b.close();
  });

  it('création d’un élément déjà sur le serveur (ex. sauvegarde restaurée) : la plus récente gagne', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const id = await createSubject(a, subject);
    await syncOnce(a, server.remote());
    await syncOnce(b, server.remote());

    // B « recrée » la même matière (même id) à 9 h, comme après une restauration de sauvegarde.
    const later = '2026-09-24T09:00:00.000Z';
    await b.runAsync(
      `UPDATE subjects SET name = ?, updated_at = ?, version = 0, sync_status = 'pending_create' WHERE id = ?`,
      ['Depuis sauvegarde', later, id],
    );
    await b.runAsync(
      `INSERT INTO sync_outbox (mutation_id, entity, entity_id, operation, payload, base_version, created_at)
       VALUES ('m-b', 'subjects', ?, 'create', '{}', NULL, ?)`,
      [id, later],
    );

    const rb = await syncOnce(b, server.remote());
    expect(rb.conflicts).toBe(0);
    expect(server.rows('subjects')).toHaveLength(1);
    expect(server.rows('subjects')[0]).toMatchObject({ name: 'Depuis sauvegarde', version: 2 });
    await syncOnce(a, server.remote());
    expect((await listSubjects(a)).map((s) => s.name)).toEqual(['Depuis sauvegarde']);

    // Et si la copie du serveur est la plus récente, elle gagne et B garde la sienne de côté.
    jest.setSystemTime(new Date('2026-09-24T10:00:00.000Z'));
    await updateSubject(a, id, { ...subject, name: 'Version serveur' });
    await syncOnce(a, server.remote());
    await b.runAsync(
      `UPDATE subjects SET name = ?, updated_at = ?, version = 0, sync_status = 'pending_create' WHERE id = ?`,
      ['Ancienne copie', later, id],
    );
    await b.runAsync(
      `INSERT INTO sync_outbox (mutation_id, entity, entity_id, operation, payload, base_version, created_at)
       VALUES ('m-b2', 'subjects', ?, 'create', '{}', NULL, ?)`,
      [id, later],
    );
    const rb2 = await syncOnce(b, server.remote());
    expect(rb2.conflicts).toBe(1);
    expect((await listSubjects(b)).map((s) => s.name)).toEqual(['Version serveur']);
    expect(await pendingCount(b)).toBe(0);
    a.close();
    b.close();
  });

  it('une réponse perdue ne crée ni doublon ni faux conflit', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const id = await createSubject(a, subject);
    server.loseNextResponse = true;
    await expect(syncOnce(a, server.remote())).rejects.toThrow('network lost');
    expect(await pendingCount(a)).toBe(1);
    const r = await syncOnce(a, server.remote());
    expect(r.conflicts).toBe(0);
    expect(server.rows('subjects')).toHaveLength(1);
    expect(await pendingCount(a)).toBe(0);

    jest.setSystemTime(new Date('2026-09-24T09:00:00.000Z'));
    await updateSubject(a, id, { ...subject, name: 'Renommée' });
    server.loseNextResponse = true;
    await expect(syncOnce(a, server.remote())).rejects.toThrow();
    const r2 = await syncOnce(a, server.remote());
    expect(r2.conflicts).toBe(0);
    expect(server.rows('subjects')[0]).toMatchObject({ name: 'Renommée' });
    a.close();
  });

  it('ne remplace pas une modification locale pas encore envoyée', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const id = await createSubject(a, subject);
    await syncOnce(a, server.remote());
    await syncOnce(b, server.remote());
    jest.setSystemTime(new Date('2026-09-24T09:00:00.000Z'));
    await updateSubject(a, id, { ...subject, name: 'Serveur' });
    await syncOnce(a, server.remote());
    jest.setSystemTime(new Date('2026-09-24T10:00:00.000Z'));
    await updateSubject(b, id, { ...subject, name: 'Local B' });
    // B reçoit sans avoir encore envoyé : sa version locale reste, puis gagne à l'envoi (plus récente).
    await syncOnce(b, server.remote());
    expect((await listSubjects(b)).map((s) => s.name)).toEqual(['Local B']);
    expect(server.rows('subjects')[0]?.name).toBe('Local B');
    a.close();
    b.close();
  });
});
