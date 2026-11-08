import type Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

import type { ColorTokens } from '@/shared/theme';

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

/**
 * Icône et couleur de chaque sorte d'élément dans les menus d'ajout (le + et « Autre ») :
 * la même tâche, la même note, le même rendez-vous partout.
 */
export const itemLooks: Record<ItemType, ItemLook> = {
  expense: { icon: 'minus', color: 'danger', background: 'dangerSoft' },
  income: { icon: 'plus', color: 'success', background: 'successSoft' },
  task: { icon: 'check-square', color: 'primary', background: 'primarySoft' },
  note: { icon: 'file-text', color: 'warning', background: 'warningSoft' },
  event: { icon: 'calendar', color: 'success', background: 'successSoft' },
  timer: { icon: 'clock', color: 'primary', background: 'primarySoft' },
  exam: { icon: 'award', color: 'danger', background: 'dangerSoft' },
  course: { icon: 'book', color: 'primary', background: 'primarySoft' },
  subject: { icon: 'book-open', color: 'warning', background: 'warningSoft' },
  other: { icon: 'more-horizontal', color: 'muted', background: 'background' },
};
