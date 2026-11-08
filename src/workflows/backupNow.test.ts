import { createSubject } from '@/modules/academic';
import { getAccountOwner, setAccountOwner } from '@/modules/identity';
import { pendingCount, syncOnce, type SyncStatus } from '@/modules/platform';
import type { Db } from '@/shared/db';
import { FakeServer } from '@/test/fakeServer';
import { createTestDb } from '@/test/memoryDb';

import { backupNow, type BackupNowDeps } from './backupNow';

const USER = 'user-1';

/** Comme `runSync` : lance la vraie synchronisation sur un faux serveur, ou échoue hors ligne. */
function fakeDeps(server: FakeServer, offline = false): BackupNowDeps & { calls: number } {
  let state: SyncStatus = { state: 'idle', lastError: null };
  const deps = {
    calls: 0,
    run: async (db: Db) => {
      deps.calls++;
      if (offline) {
        state = { state: 'offline', lastError: 'errors.network' };
        return null;
      }
      const report = await syncOnce(db, server.remote());
      state = { state: 'idle', lastError: null };
      return report;
    },
    status: () => state,
  };
  return deps;
}

describe('« Sauvegarder maintenant » (avec un compte)', () => {
  beforeEach(() => jest.useFakeTimers({ now: new Date('2026-11-08T10:00:00.000Z') }));
  afterEach(() => jest.useRealTimers());

  it('envoie tout sur le compte et dit quand', async () => {
    const db = await createTestDb();
    const server = new FakeServer();
    await setAccountOwner(db, USER);
    await createSubject(db, { name: 'Maths', colorId: 'blue' });
    expect(await pendingCount(db)).toBe(1);

    const result = await backupNow(db, USER, fakeDeps(server));
    expect(result).toEqual({ kind: 'saved', at: '2026-11-08T10:00:00.000Z', pending: 0 });
    expect(server.rows('subjects').map((r) => r.name)).toEqual(['Maths']);
    db.close();
  });

  it('relie d’abord au compte des données encore sans propriétaire', async () => {
    const db = await createTestDb();
    await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const result = await backupNow(db, USER, fakeDeps(new FakeServer()));
    expect(result.kind).toBe('saved');
    expect(await getAccountOwner(db)).toBe(USER);
    db.close();
  });

  it('hors ligne : le dit, sans erreur, et garde les modifications en attente', async () => {
    const db = await createTestDb();
    await setAccountOwner(db, USER);
    await createSubject(db, { name: 'Maths', colorId: 'blue' });
    const result = await backupNow(db, USER, fakeDeps(new FakeServer(), true));
    expect(result).toEqual({ kind: 'offline' });
    expect(await pendingCount(db)).toBe(1);
    db.close();
  });

  it('une autre erreur est signalée comme telle', async () => {
    const db = await createTestDb();
    await setAccountOwner(db, USER);
    const deps: BackupNowDeps = {
      run: async () => null,
      status: () => ({ state: 'error', lastError: 'sync.error' }),
    };
    expect(await backupNow(db, USER, deps)).toEqual({ kind: 'error' });
    db.close();
  });

  it('n’envoie jamais les données d’un autre compte', async () => {
    const db = await createTestDb();
    await setAccountOwner(db, 'someone-else');
    const deps = fakeDeps(new FakeServer());
    expect(await backupNow(db, USER, deps)).toEqual({ kind: 'otherAccount' });
    expect(deps.calls).toBe(0);
    db.close();
  });
});
