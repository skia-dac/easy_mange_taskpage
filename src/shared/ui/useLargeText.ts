import { useContext } from 'react';
import { useWindowDimensions } from 'react-native';

import { AppearanceContext, textScales } from '../theme';

/** À partir de ce grossissement (téléphone × réglage de l'app), les lignes passent à la ligne. */
export const LARGE_TEXT_SCALE = 1.35;

/** Grossissement réel du texte : réglage du téléphone multiplié par celui de l'app. */
export function useTextScale(): number {
  const { fontScale } = useWindowDimensions();
  const prefs = useContext(AppearanceContext);
  return fontScale * textScales[prefs.textScale];
}

/**
 * Texte très grand (Dynamic Type, taille de police Android) : on ne coupe plus l'information
 * avec « … », la ligne passe à la ligne et les éléments se placent les uns sous les autres.
 */
export function useLargeText(): boolean {
  return useTextScale() >= LARGE_TEXT_SCALE;
}

/** Nombre de lignes affichées : `n` en temps normal, sans limite avec un très grand texte. */
export function useLineLimit(n: number): number | undefined {
  return useLargeText() ? undefined : n;
}
