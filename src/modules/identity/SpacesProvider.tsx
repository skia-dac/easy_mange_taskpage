import { useMemo, type ReactNode } from 'react';

import { settingTable, useLiveQuery } from '@/shared/db';
import { SpacesContext, spacesValue } from '@/shared/SpacesContext';
import { LEGACY_SPACES } from '@/shared/spaces';

import { getActiveSpaces } from './data/settings';

/**
 * Donne les espaces actifs à toute l'app. Rien n'est affiché avant la première lecture
 * (quelques millisecondes) : on ne montre jamais un espace désactivé, même un instant.
 */
export function SpacesProvider({ children }: { children: ReactNode }) {
  const q = useLiveQuery(getActiveSpaces, [settingTable('spaces')], []);
  // Réglage illisible : on affiche Études + Perso plutôt qu'un écran vide.
  const active = q.data ?? (q.error ? LEGACY_SPACES : null);
  // Mémo sur le contenu : relire les mêmes espaces ne refait pas rendre toute l'app.
  const activeKey = active ? JSON.stringify(active) : null;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => (active ? spacesValue(active) : null), [activeKey]);
  if (!value) return null;
  return <SpacesContext.Provider value={value}>{children}</SpacesContext.Provider>;
}
