import { createSubject, listSubjects, updateSubject } from '@/modules/academic';
import { getAccountOwner, getSyncCursor, setAccountOwner } from '@/modules/identity';
import { createNote, listNotes } from '@/modules/productivity';
import { FakeServer } from '@/test/fakeServer';
import { createTestDb } from '@/test/memoryDb';

import { createSnapshot, restoreSnapshot } from '../backup/snapshot';
import { listConflicts } from './conflicts';
import { conflictCount, pendingCount, syncOnce, SyncStopped } from './engine';

const subject = { name: 'Maths', colorId: 'blue' };

/** Ligne écrite directement sur le faux serveur, comme par un autre appareil (ou une autre version de l'app). */
function serverWrite(
  server: FakeServer,
  table: string,
  id: string,
  values: Record<string, unknown>,
) {
  const t = server.tables.get(table) ?? new Map<string, Record<string, unknown>>();
  server.tables.set(table, t);
  const current = t.get(id);
  t.set(id, {
    ...current,
    ...values,
    id,
    version: Number(current?.version ?? 0) + 1,
    server_updated_at: new Date(Date.UTC(2029, 0, 1) + t.size * 1000).toISOString(),
  });
}

describe('synchronisation : rien ne se perd, rien ne bloque', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-09-24T08:00:00.000Z') }));
  afterEach(() => jest.useRealTimers());

  it('une ligne reçue invalide est mise de côté sans bloquer le reste, ni les synchronisations suivantes', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const good = await createSubject(a, subject);
    await syncOnce(a, server.remote());
    // Un autre appareil (version plus récente de l'app) envoie une matière que B refuse (nom vide).
    const bad = server.rows('subjects')[0]!;
    serverWrite(server, 'subjects', 'bad-1', { ...bad, name: '   ' });

    const r = await syncOnce(b, server.remote());
    expect(r.incomingRejected).toBe(1);
    expect((await listSubjects(b)).map((s) => s.id)).toEqual([good]);
    const [aside] = await listConflicts(b);
    expect(aside).toMatchObject({ kind: 'incoming_rejected', entityId: 'bad-1' });
    expect(aside!.server).toMatchObject({ name: '   ' });
    // Le curseur a avancé : la suite arrive, et la ligne refusée n'est pas mise de côté deux fois.
    expect(await getSyncCursor(b, 'subjects')).not.toBeNull();
    await updateSubject(a, good, { ...subject, name: 'Algèbre' });
    await syncOnce(a, server.remote());
    await expect(syncOnce(b, server.remote())).resolves.toMatchObject({ incomingRejected: 0 });
    expect((await listSubjects(b)).map((s) => s.name)).toEqual(['Algèbre']);
    expect(await conflictCount(b)).toBe(1);
    a.close();
    b.close();
  });

  it('un lien vers un parent absent est mis de côté, puis enregistré dès que le parent arrive', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const subjectId = await createSubject(a, subject);
    const noteId = await createNote(a, { title: 'Chapitre 1', content: 'x', subjectId });
    await syncOnce(a, server.remote());
    // B reçoit la note, mais pas encore sa matière (arrivée plus tard sur le serveur).
    const subjectRow = server.tables.get('subjects')!.get(subjectId)!;
    server.tables.get('subjects')!.delete(subjectId);

    const r = await syncOnce(b, server.remote());
    expect(r.incomingRejected).toBe(1);
    expect(await listNotes(b)).toHaveLength(0);
    expect((await listConflicts(b))[0]).toMatchObject({
      kind: 'incoming_rejected',
      entityId: noteId,
    });

    // La matière arrive : la note mise de côté est enregistrée et le conflit disparaît.
    server.tables.get('subjects')!.set(subjectId, {
      ...subjectRow,
      server_updated_at: '2032-01-01T00:00:00.000Z',
    });
    await syncOnce(b, server.remote());
    expect((await listNotes(b)).map((n) => n.id)).toEqual([noteId]);
    expect(await conflictCount(b)).toBe(0);
    a.close();
    b.close();
  });

  it('s’arrête avant d’écrire quand on le lui demande (déconnexion, effacement…)', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    await createSubject(a, subject);
    await syncOnce(a, server.remote());

    await expect(syncOnce(b, server.remote(), { shouldStop: () => true })).rejects.toBeInstanceOf(
      SyncStopped,
    );
    expect(await listSubjects(b)).toHaveLength(0);
    expect(await getSyncCursor(b, 'subjects')).toBeNull();
    a.close();
    b.close();
  });

  it('restaurer une sauvegarde : elle devient la version actuelle partout, sans rien perdre', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    await setAccountOwner(a, 'u1');
    const id = await createSubject(a, subject);
    await syncOnce(a, server.remote());
    await syncOnce(b, server.remote());
    const backup = await createSnapshot(a);

    // Après la sauvegarde : B renomme la matière et en crée une autre.
    jest.setSystemTime(new Date('2026-09-24T09:00:00.000Z'));
    await updateSubject(b, id, { ...subject, name: 'Renommée sur B' });
    const later = await createSubject(b, { name: 'Physique', colorId: 'green' });
    await syncOnce(b, server.remote());
    await syncOnce(a, server.remote());

    jest.setSystemTime(new Date('2026-09-24T10:00:00.000Z'));
    // Une sauvegarde venue d'un autre compte ne change jamais le propriétaire du téléphone.
    const foreign = {
      ...backup,
      tables: {
        ...backup.tables,
        app_settings: [
          ...backup.tables.app_settings!.filter((r) => r.key !== 'account_owner'),
          { key: 'account_owner', value: 'other-user', updated_at: 'x' },
        ],
      },
    };
    await restoreSnapshot(a, foreign);
    expect(await getAccountOwner(a)).toBe('u1');
    expect(await getSyncCursor(a, 'subjects')).toBeNull();
    expect((await listSubjects(a)).map((s) => s.name)).toEqual(['Maths']);
    expect(await pendingCount(a)).toBe(1);

    await syncOnce(a, server.remote());
    // La version restaurée gagne sur le serveur ; celle de B est gardée de côté ; Physique revient.
    expect(server.tables.get('subjects')!.get(id)).toMatchObject({ name: 'Maths' });
    expect((await listSubjects(a)).map((s) => s.name).sort()).toEqual(['Maths', 'Physique']);
    expect((await listSubjects(a)).some((s) => s.id === later)).toBe(true);
    const [kept] = await listConflicts(a);
    expect(kept).toMatchObject({ kind: 'local_won' });
    expect(kept!.server).toMatchObject({ name: 'Renommée sur B' });
    await syncOnce(b, server.remote());
    expect((await listSubjects(b)).find((s) => s.id === id)?.name).toBe('Maths');
    a.close();
    b.close();
  });
});
