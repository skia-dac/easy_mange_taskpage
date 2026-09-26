import * as SecureStore from 'expo-secure-store';

/**
 * Stockage de la session de connexion dans le trousseau (iOS) / keystore (Android), jamais en clair.
 * Une session Supabase peut dépasser la taille acceptée par certaines versions d'iOS (≈ 2 Ko) :
 * on la découpe en morceaux.
 *
 * Écriture sûre : les morceaux d'une nouvelle valeur sont écrits dans l'autre « génération »
 * (`a` / `b`), puis le compteur `.n` (`b:3`) est écrit EN DERNIER. Une interruption au milieu laisse
 * donc l'ancienne valeur intacte ; les morceaux orphelins sont ignorés à la lecture et nettoyés
 * ensuite. Ancien format (compteur seul, morceaux `clé.0`, `clé.1`…) toujours lu.
 */
const CHUNK = 1800;
/** Au-delà, le compteur est considéré comme corrompu (une session fait quelques Ko). */
const MAX_CHUNKS = 64;
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

type Gen = 'a' | 'b' | '';
type Counter = { gen: Gen; count: number };

/** Les clés SecureStore n'acceptent que lettres, chiffres, « . », « - » et « _ ». */
function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

function chunkKey(k: string, gen: Gen, i: number): string {
  return gen ? `${k}.${gen}.${i}` : `${k}.${i}`;
}

/** Lit le compteur ; `null` s'il est absent ou illisible. */
function parseCounter(raw: string | null): Counter | null {
  if (raw === null) return null;
  const m = /^(?:([ab]):)?(\d+)$/.exec(raw);
  if (!m) return null;
  const count = Number(m[2]);
  if (!Number.isInteger(count) || count < 1 || count > MAX_CHUNKS) return null;
  return { gen: (m[1] as Gen | undefined) ?? '', count };
}

/** Efface les morceaux d'une génération à partir de `from`, jusqu'au premier absent. */
async function deleteChunksFrom(k: string, gen: Gen, from: number): Promise<void> {
  for (let i = from; i < MAX_CHUNKS; i++) {
    const key = chunkKey(k, gen, i);
    if ((await SecureStore.getItemAsync(key, OPTIONS)) === null) return;
    await SecureStore.deleteItemAsync(key, OPTIONS);
  }
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safeKey(key);
    const counter = parseCounter(await SecureStore.getItemAsync(`${k}.n`, OPTIONS));
    if (!counter) return null;
    const parts: string[] = [];
    for (let i = 0; i < counter.count; i++) {
      const part = await SecureStore.getItemAsync(chunkKey(k, counter.gen, i), OPTIONS);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    const k = safeKey(key);
    const previous = parseCounter(await SecureStore.getItemAsync(`${k}.n`, OPTIONS));
    const gen: Gen = previous?.gen === 'a' ? 'b' : 'a';
    const count = Math.max(1, Math.ceil(value.length / CHUNK));
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(
        chunkKey(k, gen, i),
        value.slice(i * CHUNK, (i + 1) * CHUNK),
        OPTIONS,
      );
    }
    // Le compteur en dernier : c'est lui qui rend la nouvelle valeur visible.
    await SecureStore.setItemAsync(`${k}.n`, `${gen}:${count}`, OPTIONS);
    // Nettoyage (sans conséquence s'il est interrompu) : restes de cette génération, ancienne valeur.
    await deleteChunksFrom(k, gen, count);
    if (previous) await deleteChunksFrom(k, previous.gen, 0);
  },
  async removeItem(key: string): Promise<void> {
    const k = safeKey(key);
    await SecureStore.deleteItemAsync(`${k}.n`, OPTIONS);
    for (const gen of ['', 'a', 'b'] as const) await deleteChunksFrom(k, gen, 0);
  },
};
