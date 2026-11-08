import type Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

import type { ColorTokens } from '@/shared/theme';
import { itemTypes } from '@/shared/ui';

export type ItemType =
  | 'expense'
  | 'income'
  | 'task'
  | 'note'
  | 'event'
  | 'timer'
  | 'exam'
  | 'course'
  | 'subject'
  | 'other';

export type ItemLook = {
  icon: ComponentProps<typeof Feather>['name'];
  color: keyof ColorTokens;
  background: keyof ColorTokens;
};

function look(type: keyof typeof itemTypes): ItemLook {
  const { icon, color, background } = itemTypes[type];
  return { icon, color, background };
}

/**
 * Icône et couleur de chaque entrée des menus d'ajout (le + et « Autre »). Les types
 * d'éléments reprennent la table partagée `itemTypes` : la même tâche, la même note, le même
 * rendez-vous dans les menus et dans les listes. Seules les entrées propres aux menus
 * (minuteur, « Autre ») sont définies ici.
 */
export const itemLooks: Record<ItemType, ItemLook> = {
  expense: look('expense'),
  income: look('income'),
  task: look('task'),
  note: look('note'),
  event: look('event'),
  timer: { icon: 'clock', color: 'primary', background: 'primarySoft' },
  exam: look('exam'),
  course: look('course'),
  subject: look('subject'),
  other: { icon: 'more-horizontal', color: 'muted', background: 'background' },
};
