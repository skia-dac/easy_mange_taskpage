import { createTestDb } from '@/test/memoryDb';

import {
  cancelSyncRetry,
  pendingRetryDelay,
  RETRY_MAX_MS,
  RETRY_START_MS,
  runSync,
} from './runner';
import { getSyncStatus } from './status';

/** Faux client Supabase : les lectures échouent (réseau) tant que `online` est faux ; `calls` les compte. */
const fake = { online: false, calls: 0 };
const answer = () =>
  fake.online
    ? { data: [], error: null }
    : { data: null, error: { message: 'Network request failed' } };
const query = () => {
  fake.calls++;
  const q: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'limit', 'or', 'gte']) q[m] = () => q;
  q.then = (resolve: (v: unknown) => void) => resolve(answer());
  return q;
};
jest.mock('@/modules/identity', () => ({
  ...jest.requireActual('@/modules/identity'),
  getSupabase: () => ({
    rpc: async () => answer(),
    from: () => query(),
    storage: { from: () => ({}) },
  }),
}));

describe('reprise de la synchronisation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    fake.online = false;
    fake.calls = 0;
  });
  afterEach(() => {
    cancelSyncRetry();
    jest.useRealTimers();
  });

  it('réessaie avec un délai croissant (30 s, 60 s… 5 min), puis s’arrête dès que ça réussit', async () => {
    const db = await createTestDb();
    await runSync(db, 'u1');
    expect(getSyncStatus().state).toBe('offline');
    expect(pendingRetryDelay()).toBe(RETRY_START_MS);
    expect(fake.calls).toBe(1);

    await jest.advanceTimersByTimeAsync(RETRY_START_MS);
    expect(fake.calls).toBe(2);
    expect(pendingRetryDelay()).toBe(RETRY_START_MS * 2);
    for (let i = 0; i < 6; i++) await jest.advanceTimersByTimeAsync(RETRY_MAX_MS);
    expect(pendingRetryDelay()).toBe(RETRY_MAX_MS);

    fake.online = true;
    const before = fake.calls;
    await jest.advanceTimersByTimeAsync(RETRY_MAX_MS);
    // Une passe complète en ligne : une lecture par table synchronisée.
    expect(fake.calls).toBeGreaterThan(before);
    expect(getSyncStatus().state).toBe('idle');
    expect(pendingRetryDelay()).toBeNull();
    // Le compteur repart de 30 s au prochain échec.
    fake.online = false;
    await runSync(db, 'u1');
    expect(pendingRetryDelay()).toBe(RETRY_START_MS);
    // La reprise elle-même ne remet pas le délai à zéro, un déclenchement manuel si.
    await jest.advanceTimersByTimeAsync(RETRY_START_MS);
    expect(pendingRetryDelay()).toBe(RETRY_START_MS * 2);
    await runSync(db, 'u1');
    expect(pendingRetryDelay()).toBe(RETRY_START_MS);
    db.close();
  });

  it('un nouveau déclenchement annule la reprise ; un autre compte est refusé pendant un run', async () => {
    const db = await createTestDb();
    await runSync(db, 'u1');
    expect(pendingRetryDelay()).toBe(RETRY_START_MS);
    const second = runSync(db, 'u1');
    // Pendant que u1 tourne, u2 n'obtient rien (jamais deux comptes mêlés).
    await expect(runSync(db, 'u2')).resolves.toBeNull();
    await second;
    expect(fake.calls).toBe(2);
    cancelSyncRetry();
    expect(pendingRetryDelay()).toBeNull();
    await jest.advanceTimersByTimeAsync(RETRY_MAX_MS);
    expect(fake.calls).toBe(2);
    db.close();
  });
});
