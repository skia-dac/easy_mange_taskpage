import { z } from 'zod';

import { fieldLimits } from '@/shared/fieldLimits';
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

/**
 * Icônes proposées pour une catégorie personnelle, rangées par thème (l'ordre de la grille).
 * Ajouter des icônes ne casse rien ; n'en retirer aucune : des catégories enregistrées (et
 * synchronisées) les utilisent. L'icône n'est pas contrôlée contre cette liste, ni ici ni sur
 * le serveur (`text`) : une icône inconnue reste affichée telle quelle.
 */
export const categoryIconGroups = [
  { id: 'transport', icons: ['navigation', 'truck', 'map-pin'] },
  { id: 'food', icons: ['shopping-cart', 'coffee', 'droplet'] },
  { id: 'home', icons: ['home', 'key', 'zap', 'tool'] },
  {
    id: 'communication',
    icons: ['smartphone', 'phone', 'wifi', 'message-circle', 'monitor', 'tv'],
  },
  { id: 'studies', icons: ['book', 'book-open', 'edit-3', 'printer', 'briefcase', 'award'] },
  { id: 'health', icons: ['heart', 'activity', 'thermometer', 'scissors'] },
  { id: 'shopping', icons: ['shopping-bag', 'tag', 'gift', 'package'] },
  { id: 'leisure', icons: ['music', 'headphones', 'film', 'camera', 'smile', 'star'] },
  { id: 'people', icons: ['users', 'user'] },
  { id: 'money', icons: ['repeat', 'credit-card', 'dollar-sign', 'trending-up', 'percent'] },
] as const;

export const categoryIcons: readonly string[] = categoryIconGroups.flatMap((g) => g.icons);

/**
 * Idées de catégories courantes au Cameroun : un toucher remplit le nom (traduit,
 * `money.suggestions.<id>`), l'icône et la couleur. Aucune ne reprend le nom d'une catégorie de
 * l'app (Tontine, Bourse, Vente… existent déjà).
 */
export type CategorySuggestion = { id: string; kind: CategoryKind; icon: string; colorId: string };

const suggestion =
  (kind: CategoryKind) =>
  ([id, icon, colorId]: BuiltIn): CategorySuggestion => ({ id, kind, icon, colorId });

export const categorySuggestions: readonly CategorySuggestion[] = [
  ...(
    [
      ['taxi', 'navigation', 'amber'],
      ['airtime', 'smartphone', 'teal'],
      ['data', 'wifi', 'blue'],
      ['market', 'shopping-cart', 'green'],
      ['hair', 'scissors', 'pink'],
      ['church', 'gift', 'violet'],
      ['tuition', 'book-open', 'violet'],
      ['pharmacy', 'activity', 'red'],
      ['relatives', 'users', 'green'],
      ['restaurant', 'coffee', 'amber'],
      ['rent', 'key', 'blue'],
      ['withdrawal', 'percent', 'slate'],
    ] satisfies BuiltIn[]
  ).map(suggestion('expense')),
  ...(
    [
      ['salary', 'briefcase', 'green'],
      ['sidejob', 'tool', 'amber'],
      ['pocket', 'users', 'pink'],
      ['tutoring', 'book', 'violet'],
      ['refund', 'credit-card', 'blue'],
      ['bonus', 'star', 'amber'],
    ] satisfies BuiltIn[]
  ).map(suggestion('income')),
];

/** Nom comparable : sans majuscules, accents ni espaces en trop (« Marché » = « marche »). */
export function normalizeCategoryName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Idées à proposer pour un type : celles dont le nom (traduit par `nameOf`) n'est pas déjà celui
 * d'une catégorie existante (`existingNames`, de l'app ou de l'étudiant).
 */
export function suggestionsFor(
  kind: CategoryKind,
  existingNames: readonly string[],
  nameOf: (s: CategorySuggestion) => string,
): CategorySuggestion[] {
  const taken = new Set(existingNames.map(normalizeCategoryName));
  return categorySuggestions.filter(
    (s) => s.kind === kind && !taken.has(normalizeCategoryName(nameOf(s))),
  );
}

export const categoryInputSchema = z.object({
  kind: z.enum(categoryKinds),
  name: requiredText(fieldLimits.category.max),
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
