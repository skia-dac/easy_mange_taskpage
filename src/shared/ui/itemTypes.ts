import type Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

import type { ColorTokens } from '../theme';

export type ItemType =
  | 'task'
  | 'assignment'
  | 'exam'
  | 'event'
  | 'slot'
  | 'course'
  | 'note'
  | 'revision'
  | 'subject'
  | 'habit'
  | 'expense'
  | 'income';

export type ItemTypeStyle = {
  /** Icône Feather. */
  icon: ComponentProps<typeof Feather>['name'];
  /** Couleur de l'icône (jeton du thème). */
  color: keyof ColorTokens;
  /** Fond de la pastille derrière l'icône (jeton du thème, contraste testé avec `color`). */
  background: keyof ColorTokens;
  /** Clé i18n du nom du type (« Tâche », « Rendez-vous »…). */
  labelKey: `itemType.${ItemType}`;
};

/**
 * Une icône et une couleur par type d'élément, les mêmes partout : lignes de liste, menus
 * d'ajout, recherche. Pour changer l'allure d'un type, c'est ici et nulle part ailleurs.
 */
export const itemTypes: Readonly<Record<ItemType, ItemTypeStyle>> = {
  task: {
    icon: 'check-square',
    color: 'success',
    background: 'successSoft',
    labelKey: 'itemType.task',
  },
  assignment: {
    icon: 'check-square',
    color: 'success',
    background: 'successSoft',
    labelKey: 'itemType.assignment',
  },
  exam: { icon: 'award', color: 'danger', background: 'dangerSoft', labelKey: 'itemType.exam' },
  event: { icon: 'star', color: 'warning', background: 'warningSoft', labelKey: 'itemType.event' },
  slot: { icon: 'repeat', color: 'warning', background: 'warningSoft', labelKey: 'itemType.slot' },
  course: {
    icon: 'clock',
    color: 'primary',
    background: 'primarySoft',
    labelKey: 'itemType.course',
  },
  note: {
    icon: 'file-text',
    color: 'primary',
    background: 'primarySoft',
    labelKey: 'itemType.note',
  },
  revision: {
    icon: 'book-open',
    color: 'primary',
    background: 'primarySoft',
    labelKey: 'itemType.revision',
  },
  subject: {
    icon: 'book',
    color: 'primary',
    background: 'primarySoft',
    labelKey: 'itemType.subject',
  },
  habit: {
    icon: 'target',
    color: 'success',
    background: 'successSoft',
    labelKey: 'itemType.habit',
  },
  expense: {
    icon: 'minus',
    color: 'danger',
    background: 'dangerSoft',
    labelKey: 'itemType.expense',
  },
  income: {
    icon: 'plus',
    color: 'success',
    background: 'successSoft',
    labelKey: 'itemType.income',
  },
};

export const itemTypeIds = Object.keys(itemTypes) as ItemType[];
