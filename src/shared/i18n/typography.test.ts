import fr from './locales/fr.json';

/** Toutes les valeurs du fichier, avec leur clé (pour un message d'échec lisible). */
function values(node: unknown, path = ''): [string, string][] {
  if (typeof node === 'string') return [[path, node]];
  if (node && typeof node === 'object') {
    return Object.entries(node).flatMap(([k, v]) => values(v, path ? `${path}.${k}` : k));
  }
  return [];
}

/**
 * Typographie française : jamais d'espace ordinaire (qui peut passer seule en début de ligne)
 * avant ; ? ! : ni à l'intérieur des guillemets « ». Les {{variables}} ne comptent pas.
 * Pour corriger : `node scripts/fr-typography.mjs`.
 */
describe('typographie française (fr.json)', () => {
  const texts = values(fr).map(([k, v]) => [k, v.replace(/\{\{[^}]*\}\}/g, 'X')] as const);

  it('espace insécable avant ; ? ! :', () => {
    const bad = texts.filter(([, v]) => / [;?!:]/.test(v)).map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it('espace insécable à l’intérieur des guillemets « »', () => {
    const bad = texts.filter(([, v]) => /« | »/.test(v)).map(([k]) => k);
    expect(bad).toEqual([]);
  });

  it('jamais d’espace fine insécable (U+202F) : la police du texte ne l’a pas', () => {
    // Plus Jakarta Sans n'a pas de glyphe U+202F (vérifié dans la table cmap des fichiers .ttf) ;
    // elle a U+00A0, insécable elle aussi.
    const bad = texts.filter(([, v]) => v.includes('\u202f')).map(([k]) => k);
    expect(bad).toEqual([]);
  });
});
