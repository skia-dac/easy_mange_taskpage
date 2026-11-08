import { minTouchSize, spacing, textVariants, variantMaxFontSizeMultiplier } from '@/shared/theme';

/**
 * Disposition du pied de la saisie d'une opération (montant, pavé, Enregistrer) :
 * - `regular` : pied fixe, grandes touches ;
 * - `compact` : pied fixe, touches et marges réduites (petit écran ou grand texte) ;
 * - `inline` : le montant et le pavé défilent avec le reste ; seul le bouton Enregistrer
 *   (et Supprimer) reste fixé en bas, toujours atteignable.
 */
export type AmountPadMode = 'regular' | 'compact' | 'inline';

/** Part de la hauteur disponible que le pied fixe peut prendre, au plus. */
const REGULAR_SHARE = 0.55;
const COMPACT_SHARE = 0.65;
/** Barre de titre de l'écran et marge du haut, à peu près. */
const HEADER_ESTIMATE = 100;
/** Hauteur d'un bouton principal hors texte (marges verticales). */
const BUTTON_PADDING = 24;

const grow = (variant: keyof typeof textVariants, scale: number) =>
  textVariants[variant].lineHeight * Math.min(scale, variantMaxFontSizeMultiplier[variant]);

/** Hauteur estimée du pied fixe, en points. */
export function amountPadHeight(
  mode: 'regular' | 'compact',
  scale: number,
  hasDelete: boolean,
  bottomInset: number,
): number {
  const compact = mode === 'compact';
  const keyPadding = compact ? spacing.sm : spacing.lg;
  const key = Math.max(
    compact ? minTouchSize : minTouchSize + 4,
    grow('heading', scale) + keyPadding,
  );
  const keyGap = compact ? spacing.xs : spacing.sm;
  const gap = compact ? spacing.sm : spacing.md;
  const amount = grow('display', scale);
  const button = grow('bodyStrong', scale) + BUTTON_PADDING;
  const remove = hasDelete ? Math.max(minTouchSize, grow('bodyStrong', scale)) + gap : 0;
  const padding = (compact ? spacing.sm : spacing.md) * 2 + bottomInset;
  return amount + gap + (4 * key + 3 * keyGap) + gap + button + remove + padding;
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
  if (fits('regular', REGULAR_SHARE)) return 'regular';
  if (fits('compact', COMPACT_SHARE)) return 'compact';
  return 'inline';
}
