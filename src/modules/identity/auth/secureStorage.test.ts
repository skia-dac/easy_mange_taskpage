import { secureSessionStorage } from './secureStorage';

/** Trousseau simulé par une Map ; `failOnSet` simule une interruption au milieu d'une écriture. */
const mockStore = new Map<string, string>();
const mockFail = { onSetCall: -1, calls: 0 };
jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
  getItemAsync: async (k: string) => mockStore.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => {
    if (mockFail.calls++ === mockFail.onSetCall) throw new Error('interrompu');
    mockStore.set(k, v);
  },
  deleteItemAsync: async (k: string) => {
    mockStore.delete(k);
  },
}));

const KEY = 'sb-projet-auth-token';
const big = (seed: string, n: number) => Array.from({ length: n }, (_, i) => seed + i).join('|');

beforeEach(() => {
  mockStore.clear();
  mockFail.onSetCall = -1;
  mockFail.calls = 0;
});

describe('stockage sécurisé de la session', () => {
  it('découpe une valeur de plus de 2 Ko et la recompose à l’identique', async () => {
    const value = big('é-session-', 600);
    expect(value.length).toBeGreaterThan(4000);
    await secureSessionStorage.setItem(KEY, value);
    // Aucun morceau ne dépasse la limite d'iOS.
    for (const [k, v] of mockStore) if (!k.endsWith('.n')) expect(v.length).toBeLessThan(2048);
    expect(mockStore.size).toBeGreaterThan(3);
    expect(await secureSessionStorage.getItem(KEY)).toBe(value);
  });

  it('clé nettoyée (caractères refusés par SecureStore remplacés)', async () => {
    await secureSessionStorage.setItem('sb:projet/auth', 'x');
    for (const k of mockStore.keys()) expect(k).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(await secureSessionStorage.getItem('sb:projet/auth')).toBe('x');
  });

  it('une nouvelle valeur plus courte remplace l’ancienne sans laisser de morceaux', async () => {
    await secureSessionStorage.setItem(KEY, big('a', 600));
    await secureSessionStorage.setItem(KEY, 'court');
    expect(await secureSessionStorage.getItem(KEY)).toBe('court');
    expect(mockStore.size).toBe(2); // compteur + un morceau
  });

  it('écriture interrompue avant le compteur : l’ancienne valeur reste lisible', async () => {
    const old = big('ancienne', 400);
    await secureSessionStorage.setItem(KEY, old);
    mockFail.calls = 0;
    mockFail.onSetCall = 1; // le 2e morceau de la nouvelle valeur échoue
    await expect(secureSessionStorage.setItem(KEY, big('nouvelle', 400))).rejects.toThrow();
    expect(await secureSessionStorage.getItem(KEY)).toBe(old);
    // Les morceaux orphelins n'empêchent pas l'écriture suivante.
    mockFail.onSetCall = -1;
    await secureSessionStorage.setItem(KEY, 'suivante');
    expect(await secureSessionStorage.getItem(KEY)).toBe('suivante');
    expect(mockStore.size).toBe(2);
  });

  it('compteur corrompu ou morceau manquant : aucune session (pas de valeur tronquée)', async () => {
    for (const bad of ['abc', '-1', '0', '1.5', '9999', 'c:2']) {
      mockStore.set(`${KEY}.n`, bad);
      expect(await secureSessionStorage.getItem(KEY)).toBeNull();
    }
    await secureSessionStorage.setItem(KEY, big('x', 600));
    const first = [...mockStore.keys()].find((k) => k.endsWith('.0'))!;
    mockStore.delete(first);
    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
  });

  it('lit encore l’ancien format (compteur seul, morceaux clé.0, clé.1)', async () => {
    mockStore.set(`${KEY}.n`, '2');
    mockStore.set(`${KEY}.0`, 'bon');
    mockStore.set(`${KEY}.1`, 'jour');
    expect(await secureSessionStorage.getItem(KEY)).toBe('bonjour');
    await secureSessionStorage.setItem(KEY, 'neuf');
    expect(await secureSessionStorage.getItem(KEY)).toBe('neuf');
    expect(mockStore.has(`${KEY}.0`)).toBe(false);
  });

  it('removeItem efface le compteur et tous les morceaux, orphelins compris', async () => {
    await secureSessionStorage.setItem(KEY, big('s', 600));
    mockStore.set(`${KEY}.b.0`, 'orphelin');
    mockStore.set(`${KEY}.0`, 'ancien format');
    mockStore.set('autre-cle.n', '1');
    await secureSessionStorage.removeItem(KEY);
    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
    expect([...mockStore.keys()]).toEqual(['autre-cle.n']);
  });

  it('valeur absente : null', async () => {
    expect(await secureSessionStorage.getItem(KEY)).toBeNull();
    await expect(secureSessionStorage.removeItem(KEY)).resolves.toBeUndefined();
  });
});
