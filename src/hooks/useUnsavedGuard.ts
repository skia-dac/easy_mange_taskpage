import { useNavigation, usePreventRemove } from 'expo-router/react-navigation';
import { useCallback, useRef, useState } from 'react';

import { confirmDiscard } from '@/shared/ui';

/**
 * Formulaire modifié : quitter l'écran (retour, geste, bouton Android) demande
 * « Abandonner les modifications ? ». Retourne `leave(go)` : à appeler pour sortir sans question
 * après un enregistrement ou une suppression réussis.
 *
 * Expo Router (SDK 57) expose `usePreventRemove` par `expo-router/react-navigation` ; il bloque aussi
 * le geste de retour natif de la pile.
 */
export function useUnsavedGuard(dirty: boolean): (go: () => void) => void {
  const navigation = useNavigation();
  // Sortie voulue (enregistré, supprimé) : la demande de retrait passe sans question.
  const leaving = useRef(false);

  usePreventRemove(dirty, ({ data }) => {
    if (leaving.current) {
      navigation.dispatch(data.action);
      return;
    }
    void confirmDiscard().then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });

  // La sortie peut être traitée un peu plus tard par le routeur : le drapeau reste levé, l'écran
  // va disparaître.
  return useCallback((go: () => void) => {
    leaving.current = true;
    go();
  }, []);
}

/**
 * Le formulaire a-t-il changé depuis son état de départ ? `ready` : l'état de départ est connu
 * (fiche chargée, valeurs par défaut posées). `markClean(v)` : `v` devient le nouvel état de départ
 * (ex. fiche chargée de la base).
 */
export function useDirty<T>(
  value: T,
  ready = true,
): { dirty: boolean; markClean: (value: T) => void } {
  const current = JSON.stringify(value);
  const [baseline, setBaseline] = useState<string | null>(ready ? current : null);
  // Premier rendu « prêt » : la valeur affichée est l'état de départ.
  if (ready && baseline === null) setBaseline(current);
  const markClean = useCallback((v: T) => setBaseline(JSON.stringify(v)), []);
  return { dirty: ready && baseline !== null && current !== baseline, markClean };
}
