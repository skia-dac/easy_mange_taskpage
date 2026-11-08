import { useCallback, useEffect, useRef, useState } from 'react';

import { logger } from '@/shared/logger';

/**
 * Où en est la fiche à modifier :
 * - `loading` : lecture en cours (le formulaire n'est pas encore affiché) ;
 * - `ready` : fiche chargée (ou création : rien à lire) ;
 * - `missing` : la fiche n'existe plus ;
 * - `error` : la lecture a échoué (« Réessayer »).
 */
export type EditLoadState = 'loading' | 'ready' | 'missing' | 'error';

/**
 * Charge la fiche d'un formulaire de modification **avant** d'afficher ses champs : rien n'est
 * montré avec les valeurs par défaut, et la lecture ne peut pas écraser une saisie (les champs
 * n'apparaissent qu'une fois `ready`).
 *
 * - `id` absent : création, `ready` tout de suite, `loader` n'est pas appelé.
 * - `loader(id)` résout `null`/`undefined` : `missing`.
 * - `onLoaded(item)` reçoit la fiche juste avant `ready` (dans le même rendu) : l'état de départ
 *   de `useDirty(form, state === 'ready')` est donc la fiche chargée.
 * - `retry()` relance une lecture échouée.
 */
export function useEditLoad<T>(
  id: string | null | undefined,
  loader: (id: string) => Promise<T | null | undefined>,
  onLoaded: (item: T) => void,
): { state: EditLoadState; retry: () => void } {
  const [attempt, setAttempt] = useState(0);
  // Résultat de la dernière lecture terminée, avec la lecture à laquelle il répond.
  const [result, setResult] = useState<{ key: string; state: EditLoadState } | null>(null);
  const key = id ? `${id}#${attempt}` : null;
  // Les fonctions changent à chaque rendu : seule la dernière compte, sans relancer la lecture.
  const load = useRef(loader);
  const loaded = useRef(onLoaded);
  useEffect(() => {
    load.current = loader;
    loaded.current = onLoaded;
  });

  useEffect(() => {
    if (!id || !key) return;
    let active = true;
    load
      .current(id)
      .then((item) => {
        if (!active) return;
        if (item === null || item === undefined) {
          setResult({ key, state: 'missing' });
          return;
        }
        loaded.current(item);
        setResult({ key, state: 'ready' });
      })
      .catch((error: unknown) => {
        if (!active) return;
        logger.error(error, { where: 'editLoad' });
        setResult({ key, state: 'error' });
      });
    return () => {
      active = false;
    };
  }, [id, key]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const state: EditLoadState = !key ? 'ready' : result?.key === key ? result.state : 'loading';
  return { state, retry };
}
