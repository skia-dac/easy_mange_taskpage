import en from './locales/en.json';
import fr from './locales/fr.json';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v !== null && typeof v === 'object' ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('traductions', () => {
  it('le français et l’anglais ont exactement les mêmes clés', () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort());
  });

  it('aucun texte n’est vide', () => {
    for (const locale of [fr, en]) {
      const empty = keys(locale).filter((k) => {
        const value = k
          .split('.')
          .reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], locale);
        return typeof value !== 'string' || value.trim() === '';
      });
      expect(empty).toEqual([]);
    }
  });
});
