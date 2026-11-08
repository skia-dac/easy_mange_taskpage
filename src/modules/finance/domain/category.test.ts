import { readFileSync } from 'node:fs';

import en from '@/shared/i18n/locales/en.json';
import fr from '@/shared/i18n/locales/fr.json';
import { fieldLimits } from '@/shared/fieldLimits';

import {
  builtInCategories,
  categoryIconGroups,
  categoryIcons,
  categorySuggestions,
  normalizeCategoryName,
  suggestionsFor,
} from './category';

/** Liste d'icônes avant l'écran « Nouvelle catégorie » : des catégories enregistrées les utilisent. */
const previousIcons = [
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
];

const feather = JSON.parse(
  readFileSync(
    require.resolve('@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/Feather.json'),
    'utf8',
  ),
) as Record<string, number>;

describe('icônes des catégories', () => {
  it('garde toutes les anciennes icônes (compatibilité des catégories enregistrées)', () => {
    expect(categoryIcons).toEqual(expect.arrayContaining(previousIcons));
    expect(categoryIcons.length).toBeGreaterThanOrEqual(40);
  });

  it('sans doublon, et chaque icône existe dans Feather', () => {
    expect(new Set(categoryIcons).size).toBe(categoryIcons.length);
    expect(categoryIcons.filter((i) => !(i in feather))).toEqual([]);
    expect(categoryIconGroups.flatMap((g) => g.icons)).toEqual(categoryIcons);
  });

  it('chaque icône a un nom lisible en français et en anglais', () => {
    expect(categoryIcons.filter((i) => !(i in fr.money.icons))).toEqual([]);
    expect(categoryIcons.filter((i) => !(i in en.money.icons))).toEqual([]);
  });
});

describe('idées de catégories', () => {
  const nameFr = (s: { id: string }) =>
    (fr.money.suggestions as Record<string, string>)[s.id] ?? '';
  const nameEn = (s: { id: string }) =>
    (en.money.suggestions as Record<string, string>)[s.id] ?? '';
  const builtInFr = builtInCategories.map(
    (c) => (fr.money.cat as Record<string, string>)[c.id] ?? '',
  );
  const builtInEn = builtInCategories.map(
    (c) => (en.money.cat as Record<string, string>)[c.id] ?? '',
  );

  it('icône de la liste, couleur connue, nom traduit qui tient dans le champ', () => {
    for (const s of categorySuggestions) {
      expect(categoryIcons).toContain(s.icon);
      expect(['violet', 'teal', 'green', 'pink', 'amber', 'blue', 'red', 'slate']).toContain(
        s.colorId,
      );
      for (const name of [nameFr(s), nameEn(s)]) {
        expect(name.length).toBeGreaterThan(0);
        expect(name.length).toBeLessThanOrEqual(fieldLimits.category.max);
      }
    }
  });

  it('aucune idée ne reprend le nom d’une catégorie de l’app', () => {
    for (const kind of ['expense', 'income'] as const) {
      const all = categorySuggestions.filter((s) => s.kind === kind);
      expect(suggestionsFor(kind, builtInFr, nameFr)).toEqual(all);
      expect(suggestionsFor(kind, builtInEn, nameEn)).toEqual(all);
    }
  });

  it('une idée déjà créée (casse et accents ignorés) n’est plus proposée', () => {
    const left = suggestionsFor('expense', ['  MARCHE ', 'Loyer'], nameFr).map((s) => s.id);
    expect(left).not.toContain('market');
    expect(left).not.toContain('rent');
    expect(left).toContain('taxi');
    expect(suggestionsFor('income', [], nameFr).every((s) => s.kind === 'income')).toBe(true);
  });

  it('noms comparables', () => {
    expect(normalizeCategoryName(' Église   /  dons ')).toBe('eglise / dons');
  });
});
