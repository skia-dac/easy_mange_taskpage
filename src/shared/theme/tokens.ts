/**
 * Espacements, arrondis et tailles de texte : un seul endroit, comme les couleurs.
 *
 * Rythme de 4 pt : tout écart est un multiple de 4 (sauf `xxs`, l'écart serré entre un titre et
 * son sous-titre dans une ligne). Entre deux blocs d'un écran : `lg` ; dans une carte : `md` ;
 * entre un libellé et sa valeur : `xs`.
 */
export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, xxxl: 40 } as const;

export const radius = { sm: 10, md: 14, lg: 20, xl: 24, pill: 999 } as const;

export const fonts = {
  display: 'BricolageGrotesque_700Bold',
  body: 'PlusJakartaSans_400Regular',
  bodyMedium: 'PlusJakartaSans_500Medium',
  bodySemiBold: 'PlusJakartaSans_600SemiBold',
  bodyBold: 'PlusJakartaSans_700Bold',
  bodyItalic: 'PlusJakartaSans_400Regular_Italic',
  bodyBoldItalic: 'PlusJakartaSans_700Bold_Italic',
} as const;

/**
 * Échelle de texte. Niveaux d'un écran : `title` (titre de l'écran) › `heading` (section) ›
 * `bodyStrong` / `body` (contenu) › `caption` (détails) › `label` (étiquettes en capitales).
 * `display`, `headline` et `numeral` servent aux grands chiffres et à la carte mise en avant.
 */
export const textVariants = {
  /** Grand chiffre seul (minuteur). */
  numeral: { fontFamily: fonts.display, fontSize: 64, lineHeight: 72, letterSpacing: -1 },
  /** Montant ou note mis en avant. */
  display: { fontFamily: fonts.display, fontSize: 36, lineHeight: 44, letterSpacing: -0.8 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  /** Titre d'une carte mise en avant (« Prochain cours »). */
  headline: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  heading: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24, letterSpacing: -0.3 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 22 },
  /** Texte saisi dans un champ (un peu plus grand : iOS ne zoome pas, se lit mieux). */
  input: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14 },
} as const;

export type TextVariant = keyof typeof textVariants;

/** Taille du texte au choix (Réglages › Apparence), en plus du réglage du téléphone. */
export const textScales = { small: 0.9, normal: 1, large: 1.15, xlarge: 1.3 } as const;
export type TextScale = keyof typeof textScales;

export function scaledTextVariants(scale: TextScale) {
  const k = textScales[scale];
  const out = {} as { [V in TextVariant]: (typeof textVariants)[V] };
  for (const [name, v] of Object.entries(textVariants) as [
    TextVariant,
    (typeof textVariants)[TextVariant],
  ][]) {
    (out as Record<string, unknown>)[name] = {
      ...v,
      fontSize: Math.round(v.fontSize * k),
      lineHeight: Math.round(v.lineHeight * k),
    };
  }
  return out;
}

/** Taille minimale d'une zone touchable (accessibilité). */
export const minTouchSize = 44;

/** Grossissement maximal des titres et des étiquettes (réglage d'accessibilité du téléphone). */
export const maxFontSizeMultiplier = 1.6;

/**
 * Grossissement maximal du texte courant et des saisies : 200 % au moins (WCAG 1.4.4). Les lignes
 * passent alors à la ligne au lieu de couper l'information.
 */
export const bodyMaxFontSizeMultiplier = 2;

/**
 * Plafond de grossissement de chaque niveau de texte. Les grands titres et chiffres sont déjà
 * grands : ils plafonnent plus tôt pour ne pas déborder de l'écran.
 */
export const variantMaxFontSizeMultiplier: Record<TextVariant, number> = {
  numeral: 1.2,
  display: 1.3,
  title: 1.4,
  headline: 1.4,
  heading: maxFontSizeMultiplier,
  body: bodyMaxFontSizeMultiplier,
  bodyStrong: bodyMaxFontSizeMultiplier,
  input: bodyMaxFontSizeMultiplier,
  caption: bodyMaxFontSizeMultiplier,
  label: maxFontSizeMultiplier,
};

/** Opacité d'un élément sous le doigt (iOS ; Android montre l'onde Material). */
export const pressedOpacity = 0.6;

/** Échelle d'une carte ou d'un bouton sous le doigt. */
export const pressedScale = 0.97;
