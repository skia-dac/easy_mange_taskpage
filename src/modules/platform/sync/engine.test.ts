import {
  cancelOccurrence,
  createCourse,
  createSubject,
  listCourseExceptions,
  listSubjects,
  updateSubject,
} from '@/modules/academic';
import { createNote, deleteNote, listNotes } from '@/modules/productivity';
import { FakeServer } from '@/test/fakeServer';
import { createTestDb } from '@/test/memoryDb';

import { canRestore, ignoreConflict, listConflicts, restoreConflict } from './conflicts';
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
    expect(ra.conflicts).toBe(1);
    expect(server.rows('subjects')[0]).toMatchObject({ name: 'Version A', version: 3 });
    // La version de B, remplacée, n'est pas perdue en silence : A la garde de côté.
    const [kept] = await listConflicts(a);
    expect(kept).toMatchObject({ kind: 'local_won', local: { name: 'Version A' } });
    expect(kept!.server).toMatchObject({ name: 'Version B' });
    expect(canRestore(kept!)).toBe(true);
    await syncOnce(b, server.remote());
    expect((await listSubjects(b)).map((s) => s.name)).toEqual(['Version A']);

    // « Reprendre l'autre version » : B revient partout.
    jest.setSystemTime(new Date('2026-09-24T11:00:00.000Z'));
    await restoreConflict(a, kept!.id);
    expect((await listSubjects(a)).map((s) => s.name)).toEqual(['Version B']);
    await syncOnce(a, server.remote());
    await syncOnce(b, server.remote());
    expect((await listSubjects(b)).map((s) => s.name)).toEqual(['Version B']);
    a.close();
    b.close();
  });

  it('conflit sans différence de contenu : rien n’est gardé de côté', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const id = await createSubject(a, subject);
    await syncOnce(a, server.remote());
    await syncOnce(b, server.remote());

    jest.setSystemTime(new Date('2026-09-24T09:00:00.000Z'));
    await updateSubject(b, id, { ...subject, name: 'Pareil' });
    await syncOnce(b, server.remote());
    jest.setSystemTime(new Date('2026-09-24T10:00:00.000Z'));
    await updateSubject(a, id, { ...subject, name: 'Pareil' });

    await syncOnce(a, server.remote());
    expect(await conflictCount(a)).toBe(0);
    expect(server.rows('subjects')[0]).toMatchObject({ name: 'Pareil' });
    a.close();
    b.close();
  });

  it('une modification faite pendant l’envoi n’est jamais écrasée par la version du serveur', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const id = await createSubject(a, subject);
    await syncOnce(a, server.remote());
    await syncOnce(b, server.remote());

    // B modifie à 10 h (gagnerait sur l'heure), A à 9 h, puis A modifie encore pendant l'envoi.
    jest.setSystemTime(new Date('2026-09-24T10:00:00.000Z'));
    await updateSubject(b, id, { ...subject, name: 'Version B' });
    await syncOnce(b, server.remote());
    jest.setSystemTime(new Date('2026-09-24T09:00:00.000Z'));
    await updateSubject(a, id, { ...subject, name: 'Version A1' });
    const remote = server.remote();
    const pushOnce = remote.push.bind(remote);
    let edited = false;
    remote.push = async (mutations) => {
      const results = await pushOnce(mutations);
      if (!edited) {
        edited = true;
        await updateSubject(a, id, { ...subject, name: 'Version A2' });
      }
      return results;
    };

    await syncOnce(a, remote);
    // La modification faite pendant l'aller-retour gagne et part ; celle de B est gardée de côté.
    expect((await listSubjects(a)).map((s) => s.name)).toEqual(['Version A2']);
    expect(server.rows('subjects')[0]).toMatchObject({ name: 'Version A2' });
    const [kept] = await listConflicts(a);
    expect(kept).toMatchObject({ kind: 'local_won' });
    expect(kept!.server).toMatchObject({ name: 'Version B' });
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
    expect(rb.conflicts).toBe(1);
    // La copie du serveur, remplacée, reste disponible sur B.
    expect((await listConflicts(b))[0]).toMatchObject({ kind: 'local_won' });
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

  it('une modification refusée par le serveur est mise de côté et ne bloque ni les autres ni la réception', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const fromB = await createSubject(b, { name: 'Physique', colorId: 'red' });
    await syncOnce(b, server.remote());

    const bad = await createSubject(a, { name: 'Invalide', colorId: 'blue' });
    const good = await createSubject(a, subject);
    server.rejectIds.add(bad);
    const ra = await syncOnce(a, server.remote());
    expect(ra.rejected).toBe(1);
    expect(ra.pushed).toBe(1);
    expect(ra.pulled).toBe(1);
    expect(
      server
        .rows('subjects')
        .map((r) => r.id)
        .sort(),
    ).toEqual([fromB, good].sort());
    // Sortie de la file, gardée de côté avec la raison ; la réception a bien eu lieu.
    expect(await pendingCount(a)).toBe(0);
    expect(await conflictCount(a)).toBe(1);
    const kept = await a.getFirstAsync<{ entity_id: string; server_payload: string }>(
      'SELECT entity_id, server_payload FROM sync_conflicts',
      [],
    );
    expect(kept?.entity_id).toBe(bad);
    expect(JSON.parse(kept!.server_payload)).toEqual({ reason: 'not-null violation' });
    expect((await listSubjects(a)).map((s) => s.name).sort()).toEqual([
      'Invalide',
      'Maths',
      'Physique',
    ]);
    a.close();
    b.close();
  });

  it('après un refus, la ligne redevient synchronisée et reçoit la modification d’un autre téléphone', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const id = await createSubject(a, subject);
    await syncOnce(a, server.remote());
    await syncOnce(b, server.remote());

    // A modifie, le serveur refuse : plus rien dans la file, la ligne n'est plus « à envoyer ».
    jest.setSystemTime(new Date('2026-09-24T09:00:00.000Z'));
    await updateSubject(a, id, { ...subject, name: 'Refusée' });
    server.rejectIds.add(id);
    expect((await syncOnce(a, server.remote())).rejected).toBe(1);
    server.rejectIds.delete(id);
    const after = await a.getFirstAsync<{ sync_status: string; version: number }>(
      'SELECT sync_status, version FROM subjects WHERE id = ?',
      [id],
    );
    expect(after).toEqual({ sync_status: 'synced', version: 1 });
    expect(await pendingCount(a)).toBe(0);

    // B modifie la même matière : A la reçoit (avant, la ligne restait figée en pending_update).
    jest.setSystemTime(new Date('2026-09-24T10:00:00.000Z'));
    await updateSubject(b, id, { ...subject, name: 'Depuis B' });
    await syncOnce(b, server.remote());
    const r = await syncOnce(a, server.remote());
    expect(r.skipped).toBe(0);
    expect((await listSubjects(a)).map((s) => s.name)).toEqual(['Depuis B']);
    a.close();
    b.close();
  });

  it('ignorer un refus remet à « synchronisée » une ligne restée en attente sans rien dans la file', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const id = await createSubject(a, subject);
    await syncOnce(a, server.remote());
    await syncOnce(b, server.remote());
    // Ligne figée par une ancienne version de l'app : pending_update, file vide, refus gardé.
    await a.runAsync(
      "UPDATE subjects SET sync_status = 'pending_update', name = 'Figée' WHERE id = ?",
      [id],
    );
    await a.runAsync(
      `INSERT INTO sync_conflicts (id, entity, entity_id, local_payload, server_payload, created_at, kind)
       VALUES ('c', 'subjects', ?, ?, ?, 'x', 'rejected')`,
      [id, JSON.stringify({ id, name: 'Figée' }), JSON.stringify({ reason: 'check violation' })],
    );
    const [conflict] = await listConflicts(a);
    expect(conflict).toMatchObject({ rejection: 'invalidValue' });
    expect(canRestore(conflict!)).toBe(false);
    // « Restaurer » ne renvoie pas la même modification refusée.
    await expect(restoreConflict(a, 'c')).rejects.toMatchObject({
      messageKey: 'conflicts.rejectedCannotRestore',
    });
    expect(await pendingCount(a)).toBe(0);

    await ignoreConflict(a, 'c');
    const row = await a.getFirstAsync<{ sync_status: string }>(
      'SELECT sync_status FROM subjects WHERE id = ?',
      [id],
    );
    expect(row?.sync_status).toBe('synced');
    jest.setSystemTime(new Date('2026-09-24T10:00:00.000Z'));
    await updateSubject(b, id, { ...subject, name: 'Depuis B' });
    await syncOnce(b, server.remote());
    await syncOnce(a, server.remote());
    expect((await listSubjects(a)).map((s) => s.name)).toEqual(['Depuis B']);
    a.close();
    b.close();
  });

  it('réception par pages : deux lignes au même horodatage réparties sur deux pages ne sont pas perdues', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    await createSubject(a, { name: 'Un', colorId: 'blue' });
    await syncOnce(a, server.remote());
    // Trois matières écrites au même instant sur le serveur.
    server.fixedStamp = '2030-06-01T00:00:00.000Z';
    for (const name of ['Deux', 'Trois', 'Quatre'])
      await createSubject(a, { name, colorId: 'blue' });
    await syncOnce(a, server.remote());
    server.fixedStamp = null;

    const rb = await syncOnce(b, server.remote(), { pageSize: 2 });
    expect(rb.pulled).toBe(4);
    expect((await listSubjects(b)).map((s) => s.name).sort()).toEqual([
      'Deux',
      'Quatre',
      'Trois',
      'Un',
    ]);
    // Une nouvelle passe relit avec une marge sans rien réappliquer ni compter deux fois.
    const rb2 = await syncOnce(b, server.remote(), { pageSize: 2 });
    expect(rb2.pulled).toBe(0);
    a.close();
    b.close();
  });

  it('exception créée sur deux appareils pour la même séance : une seule ligne vivante partout', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const subjectId = await createSubject(a, subject);
    const seriesId = await createCourse(a, {
      subjectId,
      courseType: 'lecture',
      recurrence: 'weekly',
      weekday: 1,
      startDate: '2026-09-07',
      endDate: '2026-12-14',
      startTime: '08:00',
      endTime: '10:00',
    });
    await syncOnce(a, server.remote());
    await syncOnce(b, server.remote());

    // Chacun annule la même séance hors ligne, puis les deux synchronisent jusqu'à convergence.
    await cancelOccurrence(a, seriesId, '2026-09-21');
    await cancelOccurrence(b, seriesId, '2026-09-21');
    for (let round = 0; round < 3; round++) {
      await syncOnce(a, server.remote());
      await syncOnce(b, server.remote());
    }
    const aliveA = await listCourseExceptions(a);
    const aliveB = await listCourseExceptions(b);
    expect(aliveA).toHaveLength(1);
    expect(aliveB.map((e) => e.id)).toEqual(aliveA.map((e) => e.id));
    expect(server.rows('course_exceptions').filter((r) => !r.deleted_at)).toHaveLength(1);
    expect(await pendingCount(a)).toBe(0);
    expect(await pendingCount(b)).toBe(0);
    a.close();
    b.close();
  });
});
