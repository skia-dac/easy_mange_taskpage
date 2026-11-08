import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

import { accentColors, darkColors, lightColors, type AccentId, type ColorTokens } from './colors';
import { radius, scaledTextVariants, spacing, textVariants, type TextScale } from './tokens';

export type ColorScheme = 'light' | 'dark';

export type Theme = {
  scheme: ColorScheme;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  text: typeof textVariants;
};

/**
 * Thèmes déjà calculés, un par (mode, couleur, taille de texte) : le même objet est rendu à chaque
 * appel, pour que `colors` ne change pas d'identité à chaque rendu (mémos, listes, styles).
 */
const themes = new Map<string, Theme>();

export function getTheme(
  scheme: ColorScheme,
  accent: AccentId = 'blue',
  textScale: TextScale = 'normal',
): Theme {
  const key = `${scheme}|${accent}|${textScale}`;
  const cached = themes.get(key);
  if (cached) return cached;
  const theme = buildTheme(scheme, accent, textScale);
  themes.set(key, theme);
  return theme;
}

function buildTheme(scheme: ColorScheme, accent: AccentId, textScale: TextScale): Theme {
  const base = scheme === 'dark' ? darkColors : lightColors;
  const a = (accentColors[accent] ?? accentColors.blue)[scheme];
  return {
    scheme,
    colors: { ...base, ...a },
    spacing,
    radius,
    text: textScale === 'normal' ? textVariants : scaledTextVariants(textScale),
  };
}

export type AppearanceMode = 'auto' | 'light' | 'dark';

/** Choix de l'utilisateur (Réglages → Apparence). */
export type ThemePrefs = { mode: AppearanceMode; accent: AccentId; textScale: TextScale };

export const defaultThemePrefs: ThemePrefs = { mode: 'auto', accent: 'blue', textScale: 'normal' };

export const AppearanceContext = createContext<ThemePrefs>(defaultThemePrefs);

/** Thème courant : les choix de l'utilisateur, sinon le mode clair / sombre du téléphone. */
export function useTheme(): Theme {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const prefs = useContext(AppearanceContext);
  return getTheme(prefs.mode === 'auto' ? system : prefs.mode, prefs.accent, prefs.textScale);
}
