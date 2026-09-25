import * as SecureStore from 'expo-secure-store';

/**
 * Stockage de la session de connexion dans le trousseau (iOS) / keystore (Android), jamais en clair.
 * Une session Supabase peut dépasser la taille acceptée par certaines versions d'iOS (≈ 2 Ko) :
 * on la découpe en morceaux.
 */
const CHUNK = 1800;
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

/** Les clés SecureStore n'acceptent que lettres, chiffres, « . », « - » et « _ ». */
function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, '_');
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const k = safeKey(key);
    const count = await SecureStore.getItemAsync(`${k}.n`, OPTIONS);
    if (count === null) return null;
    const parts: string[] = [];
    for (let i = 0; i < Number(count); i++) {
      const part = await SecureStore.getItemAsync(`${k}.${i}`, OPTIONS);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    const k = safeKey(key);
    await this.removeItem(key);
    const count = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(`${k}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), OPTIONS);
    }
    await SecureStore.setItemAsync(`${k}.n`, String(count), OPTIONS);
  },
  async removeItem(key: string): Promise<void> {
    const k = safeKey(key);
    const count = await SecureStore.getItemAsync(`${k}.n`, OPTIONS);
    await SecureStore.deleteItemAsync(`${k}.n`, OPTIONS);
    for (let i = 0; i < Number(count ?? 0); i++)
      await SecureStore.deleteItemAsync(`${k}.${i}`, OPTIONS);
  },
};
