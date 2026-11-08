import type { ReactNode } from 'react';
import { useMemo } from 'react';

import { settingTable, useLiveQuery } from '@/shared/db';
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
    [settingTable('appearance'), settingTable('accent'), settingTable('text_scale')],
    [],
  );
  // Mémo sur les valeurs, pas sur l'objet relu : un rechargement identique ne refait rien rendre.
  const mode = pref.data?.mode ?? defaultThemePrefs.mode;
  const accent = pref.data?.accent ?? defaultThemePrefs.accent;
  const textScale = pref.data?.textScale ?? defaultThemePrefs.textScale;
  const value = useMemo<ThemePrefs>(() => ({ mode, accent, textScale }), [mode, accent, textScale]);
  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}
