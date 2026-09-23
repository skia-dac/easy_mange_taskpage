import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors, type ColorTokens } from './colors';
import { radius, spacing, textVariants } from './tokens';

export type ColorScheme = 'light' | 'dark';

export type Theme = {
  scheme: ColorScheme;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  text: typeof textVariants;
};

export function getTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    spacing,
    radius,
    text: textVariants,
  };
}

export type AppearanceMode = 'auto' | 'light' | 'dark';

/** Choix de l'utilisateur (Réglages → Apparence). 'auto' = suit le téléphone. */
export const AppearanceContext = createContext<AppearanceMode>('auto');

/** Thème courant : le choix de l'utilisateur, sinon le mode clair / sombre du téléphone. */
export function useTheme(): Theme {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const mode = useContext(AppearanceContext);
  return getTheme(mode === 'auto' ? system : mode);
}
