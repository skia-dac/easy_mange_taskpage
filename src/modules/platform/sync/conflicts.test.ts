import { createSubject, listSubjects, updateSubject } from '@/modules/academic';
import { FakeServer } from '@/test/fakeServer';
import { createTestDb } from '@/test/memoryDb';

import {
  CONFLICT_PREVIEW,
  conflictFields,
  ignoreConflict,
  listConflicts,
  restoreConflict,
} from './conflicts';
import { conflictCount, pendingCount, syncOnce } from './engine';

const subject = { name: 'Maths', colorId: 'blue' };

describe('conflits de synchronisation (écran)', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-09-24T08:00:00.000Z') }));
  afterEach(() => jest.useRealTimers());

  it('liste, restaure (via la file d’envoi) ou ignore une version gardée de côté', async () => {
    const server = new FakeServer();
    const a = await createTestDb();
    const b = await createTestDb();
    const id = await createSubject(a, subject);
    await syncOnce(a, server.remote());
    await syncOnce(b, server.remote());
    jest.setSystemTime(new Date('2026-09-24T09:00:00.000Z'));
    await updateSubject(a, id, { ...subject, name: 'Version A' });
    jest.setSystemTime(new Date('2026-09-24T10:00:00.000Z'));
    await updateSubject(b, id, { ...subject, name: 'Version B' });
    await syncOnce(b, server.remote());
    await syncOnce(a, server.remote());

    const list = await listConflicts(a);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ entity: 'subjects', entityId: id, title: 'Version A' });
    expect(list[0]?.reason).toBeNull();
    // Les deux versions sont lisibles côte à côte avant de choisir.
    expect(list[0]?.server).toMatchObject({ name: 'Version B' });
    expect(conflictFields(list[0]!).find((f) => f.column === 'name')).toMatchObject({
      local: 'Version A',
      server: 'Version B',
      differs: true,
    });

    // Restaurer : la ligne locale reprend « Version A », part par la file, et gagne sur le serveur.
    jest.setSystemTime(new Date('2026-09-24T11:00:00.000Z'));
    await restoreConflict(a, list[0]!.id);
    expect((await listSubjects(a)).map((s) => s.name)).toEqual(['Version A']);
    expect(await pendingCount(a)).toBe(1);
    expect(await conflictCount(a)).toBe(0);
    const r = await syncOnce(a, server.remote());
    expect(r.conflicts).toBe(0);
    expect(server.rows('subjects')[0]).toMatchObject({ name: 'Version A' });
    await syncOnce(b, server.remote());
    expect((await listSubjects(b)).map((s) => s.name)).toEqual(['Version A']);

    // Ignorer : rien ne change, le conflit est classé.
    await a.runAsync(
      `INSERT INTO sync_conflicts (id, entity, entity_id, local_payload, server_payload, created_at)
       VALUES ('c2', 'subjects', ?, ?, ?, ?)`,
      [id, JSON.stringify({ id, name: 'Rejetée' }), JSON.stringify({ reason: 'not null' }), 'x'],
    );
    const [rejected] = await listConflicts(a);
    expect(rejected).toMatchObject({ title: 'Rejetée', reason: 'not null' });
    await ignoreConflict(a, 'c2');
    expect(await conflictCount(a)).toBe(0);
    expect((await listSubjects(a)).map((s) => s.name)).toEqual(['Version A']);
    a.close();
    b.close();
  });

  it('restaure une ligne disparue en la recréant', async () => {
    const a = await createTestDb();
    const id = await createSubject(a, subject);
    await a.runAsync('DELETE FROM subjects WHERE id = ?', [id]);
    await a.runAsync('DELETE FROM sync_outbox', []);
    await a.runAsync(
      `INSERT INTO sync_conflicts (id, entity, entity_id, local_payload, server_payload, created_at)
       VALUES ('c', 'subjects', ?, ?, '{}', 'x')`,
      [id, JSON.stringify({ id, name: 'Revenue', color_id: 'blue', created_at: 'x' })],
    );
    await restoreConflict(a, 'c');
    expect((await listSubjects(a)).map((s) => s.name)).toEqual(['Revenue']);
    expect(await pendingCount(a)).toBe(1);
    a.close();
  });

  it('champs clés selon le type : montant avec sa devise, date, aperçu des longs textes, suppression', () => {
    const fields = conflictFields({
      local: {
        id: 't1',
        kind: 'expense',
        amount_minor: 1500,
        currency: 'XAF',
        date: '2026-09-24',
        note: 'x'.repeat(200),
        deleted_at: null,
      },
      server: {
        id: 't1',
        kind: 'expense',
        amount_minor: 2000,
        currency: 'XAF',
        date: '2026-09-24',
        note: null,
        deleted_at: '2026-09-25T00:00:00.000Z',
      },
    });
    expect(fields.map((f) => f.column)).toEqual(['deleted_at', 'date', 'amount_minor', 'note']);
    expect(fields.find((f) => f.column === 'amount_minor')).toMatchObject({
      type: 'money',
      local: 1500,
      server: 2000,
      localCurrency: 'XAF',
      differs: true,
    });
    expect(fields.find((f) => f.column === 'date')?.differs).toBe(false);
    expect(String(fields.find((f) => f.column === 'note')?.local)).toHaveLength(
      CONFLICT_PREVIEW + 1,
    );
    expect(fields.find((f) => f.column === 'deleted_at')).toMatchObject({
      type: 'deleted',
      differs: true,
    });
    // Un refus n'a pas de version serveur : seulement la tienne, jamais « différent ».
    const rejected = conflictFields({ local: { id: 'x', title: 'Exposé' }, server: null });
    expect(rejected).toEqual([
      expect.objectContaining({ column: 'title', server: null, differs: false }),
    ]);
  });
});
