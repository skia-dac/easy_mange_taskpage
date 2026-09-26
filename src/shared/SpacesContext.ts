import { createContext, useContext } from 'react';

import { LEGACY_SPACES, type ActiveSpaces, type SpaceId } from './spaces';

export type SpacesValue = {
  /** Espaces actifs, jamais vide. */
  active: ActiveSpaces;
  has: (space: SpaceId) => boolean;
};

export const spacesValue = (active: ActiveSpaces): SpacesValue => ({
  active,
  has: (space) => active.includes(space),
});

export const SpacesContext = createContext<SpacesValue>(spacesValue(LEGACY_SPACES));

/** Espaces actifs (Études / Pro / Perso), mis à jour en direct quand on les change. */
export function useSpaces(): SpacesValue {
  return useContext(SpacesContext);
}
