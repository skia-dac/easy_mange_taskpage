type Listener = (tables: ReadonlySet<string>) => void;

const listeners = new Set<Listener>();

/** Prévient les écrans que des tables ont changé (ils rechargent leurs données). */
export function notifyChange(tables: Iterable<string>): void {
  const set = new Set(tables);
  if (set.size === 0) return;
  listeners.forEach((listener) => listener(set));
}

export function subscribeToChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
