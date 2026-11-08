import { minTouchSize, spacing, textVariants, variantMaxFontSizeMultiplier } from '@/shared/theme';
import { LARGE_TEXT_SCALE } from '@/shared/ui';

/**
 * Disposition du pied de la saisie d'une opération (pavé, Enregistrer). Le montant, lui, est
 * toujours en haut de l'écran, sous le choix Dépense / Entrée.
 * - `regular` : pied fixe, touches de 54 pt ;
 * - `compact` : pied fixe, touches de 46 pt et marges réduites (petit écran ou grand texte) ;
 * - `inline` : le pavé défile avec le reste ; seul le bouton Enregistrer (et Supprimer) reste
 *   fixé en bas, toujours atteignable.
 */
export type AmountPadMode = 'regular' | 'compact' | 'inline';

/** Part de la hauteur disponible que le pied fixe peut prendre, au plus. */
const REGULAR_SHARE = 0.55;
const COMPACT_SHARE = 0.6;
/** Barre de titre de l'écran et marge du haut, à peu près. */
const HEADER_ESTIMATE = 100;
/** Hauteur d'une touche du pavé, sans grand texte (au moins 44 pt en compact). */
const KEY_HEIGHT = { regular: 54, compact: minTouchSize + 2 } as const;
/** Marges verticales du bouton principal (`Button`). */
const BUTTON_PADDING = spacing.sm * 2;

const grow = (variant: keyof typeof textVariants, scale: number) =>
  textVariants[variant].lineHeight * Math.min(scale, variantMaxFontSizeMultiplier[variant]);

/** Hauteur d'une touche : fixe, sauf si le chiffre grossi ne tient plus dedans. */
export function padKeyHeight(mode: AmountPadMode, scale: number): number {
  const compact = mode !== 'regular';
  const padding = compact ? spacing.sm : spacing.lg;
  return Math.max(
    compact ? KEY_HEIGHT.compact : KEY_HEIGHT.regular,
    grow('headline', scale) + padding,
  );
}

/** Écart entre deux touches. */
export const padKeyGap = (mode: AmountPadMode) => (mode === 'regular' ? spacing.sm : spacing.xs);

/** Hauteur estimée du pied fixe (pavé de 4 rangées, Enregistrer, Supprimer), en points. */
export function amountPadHeight(
  mode: 'regular' | 'compact',
  scale: number,
  hasDelete: boolean,
  bottomInset: number,
): number {
  const compact = mode === 'compact';
  const gap = compact ? spacing.sm : spacing.md;
  const pad = 4 * padKeyHeight(mode, scale) + 3 * padKeyGap(mode);
  const button = Math.max(minTouchSize + 8, grow('bodyStrong', scale) + BUTTON_PADDING);
  const remove = hasDelete ? Math.max(minTouchSize, grow('bodyStrong', scale)) + gap : 0;
  const padding = (compact ? spacing.sm : spacing.md) * 2 + bottomInset;
  return pad + gap + button + remove + padding;
}

export function amountPadMode(input: {
  windowHeight: number;
  /** Grossissement du texte (téléphone × réglage de l'app). */
  scale: number;
  hasDelete: boolean;
  bottomInset: number;
}): AmountPadMode {
  const available = input.windowHeight - HEADER_ESTIMATE;
  const fits = (mode: 'regular' | 'compact', share: number) =>
    amountPadHeight(mode, input.scale, input.hasDelete, input.bottomInset) <= available * share;
  // Grand texte : le haut de l'écran (montant, catégories) grandit aussi, le pavé se resserre.
  if (input.scale < LARGE_TEXT_SCALE && fits('regular', REGULAR_SHARE)) return 'regular';
  if (fits('compact', COMPACT_SHARE)) return 'compact';
  return 'inline';
}
