import { bodyMaxFontSizeMultiplier, useTheme } from '../theme';

/**
 * Réglages communs à toutes les saisies : couleur du texte indicatif, du curseur et clavier
 * sombre en mode sombre (iOS), texte qui grossit avec le réglage du téléphone.
 */
export function useInputProps() {
  const { colors, scheme } = useTheme();
  return {
    placeholderTextColor: colors.muted,
    selectionColor: colors.primary,
    cursorColor: colors.primary,
    keyboardAppearance: scheme,
    maxFontSizeMultiplier: bodyMaxFontSizeMultiplier,
  } as const;
}
