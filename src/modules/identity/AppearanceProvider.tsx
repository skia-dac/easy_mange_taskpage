import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { useLiveQuery } from '@/shared/db';
import { AppearanceContext, defaultThemePrefs, type ThemePrefs } from '@/shared/theme';

import {
  getAccentPreference,
  getAppearancePreference,
  getTextScalePreference,
} from './data/settings';

/** Applique les choix d'apparence (clair / sombre, couleur principale, taille du texte) à toute l'app. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const pref = useLiveQuery(
    async (db) => ({
      mode: await getAppearancePreference(db),
      accent: await getAccentPreference(db),
      textScale: await getTextScalePreference(db),
    }),
    ['app_settings'],
    [],
  );
  const value = useMemo<ThemePrefs>(() => pref.data ?? defaultThemePrefs, [pref.data]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
