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

/** Thème courant, qui suit le mode clair / sombre du téléphone. */
export function useTheme(): Theme {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return getTheme(scheme);
}
