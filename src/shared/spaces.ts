import { z } from 'zod';

/**
 * Les trois espaces de MySky : Études, Pro (travail) et Perso (vie privée).
 * L'étudiant ou le salarié active ceux qui le concernent ; au moins un reste toujours actif.
 * Un espace désactivé est caché, jamais effacé : ses données restent intactes et comptées.
 */
export const spaceIds = ['study', 'work', 'personal'] as const;
export type SpaceId = (typeof spaceIds)[number];
export const spaceSchema = z.enum(spaceIds);

/** Espaces actifs, dans l'ordre d'affichage, jamais vide. */
export type ActiveSpaces = readonly SpaceId[];

/** Réglage des installations d'avant les espaces : l'app était Études + Perso. */
export const LEGACY_SPACES: ActiveSpaces = ['study', 'personal'];

/** Liste propre (connue, sans doublon, dans l'ordre) ; vide ou illisible = `fallback`. */
export function normalizeSpaces(
  value: unknown,
  fallback: ActiveSpaces = LEGACY_SPACES,
): ActiveSpaces {
  if (!Array.isArray(value)) return fallback;
  const list = spaceIds.filter((id) => value.includes(id));
  return list.length > 0 ? list : fallback;
}

/**
 * Active ou coupe un espace. Refuse de couper le dernier actif (retourne la liste inchangée) :
 * il y a toujours au moins un espace.
 */
export function toggleSpace(active: ActiveSpaces, id: SpaceId, on: boolean): ActiveSpaces {
  if (on) return spaceIds.filter((s) => s === id || active.includes(s));
  const next = active.filter((s) => s !== id);
  return next.length > 0 ? next : active;
}

/** Espace proposé pour un nouvel élément : Perso, sinon Pro, sinon Études (parmi les actifs). */
export function defaultSpace(active: ActiveSpaces): SpaceId {
  for (const s of ['personal', 'work', 'study'] as const) if (active.includes(s)) return s;
  return 'personal';
}

/** Valeur lue en base (colonne `space`) : inconnue ou absente = Perso. */
export function normalizeSpaceValue(value: unknown): SpaceId {
  return spaceIds.includes(value as SpaceId) ? (value as SpaceId) : 'personal';
}
