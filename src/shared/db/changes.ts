type Listener = (tables: ReadonlySet<string>) => void;

const listeners = new Set<Listener>();

/** Prévient les écrans que des tables ont changé (ils rechargent leurs données). */
export function notifyChange(tables: Iterable<string>): void {
  const set = new Set(tables);
  if (set.size === 0) return;
  listeners.forEach((listener) => listener(set));
}

const SETTINGS = 'app_settings';
const SETTING_PREFIX = `${SETTINGS}:`;

/**
 * Une requête qui lit `watched` doit-elle se relancer après ce changement ?
 * Réglages : écrire un réglage annonce seulement `app_settings:<clé>`. Une requête qui écoute toute
 * la table `app_settings` le reçoit aussi ; une requête qui écoute un réglage précis reçoit aussi
 * un changement de toute la table (`app_settings` seul : restauration, effacement…).
 */
export function affects(watched: ReadonlySet<string>, changed: ReadonlySet<string>): boolean {
  for (const t of changed) {
    if (watched.has(t)) return true;
    if (t.startsWith(SETTING_PREFIX) && watched.has(SETTINGS)) return true;
    if (t === SETTINGS) for (const w of watched) if (w.startsWith(SETTING_PREFIX)) return true;
  }
  return false;
}

export function subscribeToChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
