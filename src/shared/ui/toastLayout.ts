import { useEffect, useSyncExternalStore } from 'react';

import { spacing } from '../theme';

/** Écart entre le message et ce qui est dessous (barre d'onglets, barre d'accueil). */
export const TOAST_BOTTOM_GAP = spacing.sm;
/** Marges du message à gauche et à droite (Material 3, iOS : 16 pt). */
export const TOAST_SIDE_MARGIN = spacing.lg;
/** Écart entre le haut du message et le bouton + quand celui-ci est remonté. */
export const TOAST_FAB_GAP = spacing.md;
/** Distance du bouton + au bas de l'écran (au-dessus de la barre), sans message. */
export const FAB_MARGIN = spacing.xl;

let height = 0;
const heightListeners = new Set<() => void>();

/**
 * Le message (monté à la racine) annonce sa hauteur visible ; 0 quand il n'y en a pas, ou quand il
 * est posé au-dessus du clavier (le bouton + est alors caché dessous et n'a pas à bouger).
 */
export function reportToastHeight(next: number): void {
  const value = Math.max(0, Math.round(next));
  if (value === height) return;
  height = value;
  heightListeners.forEach((l) => l());
}

export function getToastHeight(): number {
  return height;
}

/** Hauteur visible du message en bas de l'écran (0 sans message). */
export function useToastHeight(): number {
  return useSyncExternalStore(
    (listener) => {
      heightListeners.add(listener);
      return () => heightListeners.delete(listener);
    },
    () => height,
  );
}

/**
 * De combien le bouton + remonte pour rester au-dessus du message (règle Material : le message ne
 * recouvre jamais le bouton, le bouton lui fait de la place).
 */
export function fabLiftFor(toastHeight: number): number {
  if (toastHeight <= 0) return 0;
  return Math.max(0, TOAST_BOTTOM_GAP + toastHeight + TOAST_FAB_GAP - FAB_MARGIN);
}

let covers = 0;

/**
 * Une fenêtre (bottom sheet, menu, écran verrouillé) recouvre l'app : un message posé à la racine
 * serait caché dessous. Tant qu'elle est ouverte, une erreur passe par une alerte native.
 */
export function useCoversToast(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    covers += 1;
    return () => {
      covers -= 1;
    };
  }, [active]);
}

export function toastIsCovered(): boolean {
  return covers > 0;
}
