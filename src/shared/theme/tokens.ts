/** Espacements, arrondis et tailles de texte : un seul endroit, comme les couleurs. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;

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

export const textVariants = {
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.display, fontSize: 19, lineHeight: 24, letterSpacing: -0.3 },
  body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.bodySemiBold, fontSize: 15, lineHeight: 22 },
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
