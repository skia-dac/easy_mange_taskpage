import { z } from 'zod';

import { requiredText } from '@/shared/validation';

export const categoryKinds = ['expense', 'income'] as const;
export type CategoryKind = (typeof categoryKinds)[number];

/** Icônes Feather (identiques sur iPhone et Android). */
export type CategoryIcon = string;

export type MoneyCategory = {
  id: string;
  kind: CategoryKind;
  /** Catégorie fournie par l'app : son nom vient des traductions (`money.cat.<id>`). */
  builtIn: boolean;
  name: string | null;
  icon: CategoryIcon;
  colorId: string;
  position: number;
};

type BuiltIn = [id: string, icon: string, colorId: string];

/** Catégories de départ, pensées pour un étudiant (ordre = ordre d'affichage). */
const builtInExpense: BuiltIn[] = [
  ['food', 'shopping-cart', 'green'],
  ['drink', 'coffee', 'teal'],
  ['water', 'droplet', 'blue'],
  ['transport', 'navigation', 'amber'],
  ['clothes', 'shopping-bag', 'pink'],
  ['shoes', 'tag', 'violet'],
  ['home', 'home', 'blue'],
  ['electricity', 'zap', 'amber'],
  ['internet', 'wifi', 'teal'],
  ['school', 'book', 'violet'],
  ['supplies', 'printer', 'slate'],
  ['health', 'heart', 'red'],
  ['outings', 'music', 'pink'],
  ['family', 'users', 'green'],
  ['tontine', 'repeat', 'violet'],
  ['other', 'more-horizontal', 'slate'],
];

const builtInIncome: BuiltIn[] = [
  ['family_in', 'users', 'green'],
  ['grant', 'award', 'blue'],
  ['job', 'briefcase', 'amber'],
  ['sale', 'tag', 'teal'],
  ['tontine_in', 'repeat', 'violet'],
  ['gift', 'gift', 'pink'],
  ['other_in', 'plus-circle', 'slate'],
];

const toCategory =
  (kind: CategoryKind) =>
  ([id, icon, colorId]: BuiltIn, position: number): MoneyCategory => ({
    id,
    kind,
    builtIn: true,
    name: null,
    icon,
    colorId,
    position,
  });

export const builtInCategories: readonly MoneyCategory[] = [
  ...builtInExpense.map(toCategory('expense')),
  ...builtInIncome.map(toCategory('income')),
];

/** Catégorie utilisée pour les cotisations et les tours de tontine. */
export const TONTINE_EXPENSE = 'tontine';
export const TONTINE_INCOME = 'tontine_in';
export const OTHER_EXPENSE = 'other';
export const OTHER_INCOME = 'other_in';

export const categoryIcons = [
  'shopping-cart',
  'coffee',
  'droplet',
  'navigation',
  'shopping-bag',
  'tag',
  'home',
  'zap',
  'wifi',
  'book',
  'printer',
  'heart',
  'music',
  'users',
  'repeat',
  'gift',
  'briefcase',
  'award',
  'smartphone',
  'scissors',
  'film',
  'tool',
  'truck',
  'star',
] as const;

export const categoryInputSchema = z.object({
  kind: z.enum(categoryKinds),
  name: requiredText(30),
  icon: z.string().min(1).default('tag'),
  colorId: z.string().min(1).default('slate'),
});
export type CategoryInput = z.input<typeof categoryInputSchema>;

/** Toutes les catégories d'un type : celles de l'app puis celles de l'étudiant. */
export function categoriesOf(
  kind: CategoryKind,
  custom: readonly MoneyCategory[],
): MoneyCategory[] {
  return [
    ...builtInCategories.filter((c) => c.kind === kind),
    ...custom.filter((c) => c.kind === kind).sort((a, b) => a.position - b.position),
  ];
}

export function findCategory(
  id: string | null,
  custom: readonly MoneyCategory[],
): MoneyCategory | undefined {
  if (!id) return undefined;
  return builtInCategories.find((c) => c.id === id) ?? custom.find((c) => c.id === id);
}
