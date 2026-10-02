import type { SpaceId } from '@/shared/spaces';
import { subjectColors, type SubjectColor } from '@/shared/theme';

const COLOR_OF: Record<SpaceId, string> = { study: 'violet', work: 'blue', personal: 'green' };

/**
 * Couleur d'un espace : Études violet, Pro bleu, Perso vert (palette des matières).
 * Les espaces se choisissent dans le profil ; aucun élément ne porte d'étiquette d'espace.
 */
export function spaceColor(space: SpaceId): SubjectColor {
  return subjectColors.find((c) => c.id === COLOR_OF[space]) ?? subjectColors[0]!;
}
