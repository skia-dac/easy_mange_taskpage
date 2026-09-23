import type { ReactNode } from 'react';

import { useLiveQuery } from '@/shared/db';
import { AppearanceContext } from '@/shared/theme';

import { getAppearancePreference } from './data/settings';

/** Applique le choix clair / sombre / automatique des réglages à toute l'app. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const pref = useLiveQuery(getAppearancePreference, ['app_settings'], []);
  return (
    <AppearanceContext.Provider value={pref.data ?? 'auto'}>{children}</AppearanceContext.Provider>
  );
}
