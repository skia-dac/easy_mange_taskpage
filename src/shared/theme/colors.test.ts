import {
  accentColors,
  accentIds,
  darkColors,
  lightColors,
  subjectColors,
  type ColorTokens,
} from './colors';
import { getTheme } from './useTheme';

function luminance(hex: string): number {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;
/** Commandes, icônes et grands textes (WCAG 1.4.3 / 1.4.11). */
const AA_UI = 3;

type Token = keyof ColorTokens;

/**
 * Chaque texte de l'app et le fond sur lequel il est posé. Une nouvelle combinaison dans un
 * écran se déclare ici : le test refuse tout couple sous le seuil AA, en clair comme en sombre.
 */
const textPairs: [fg: Token, bg: Token, where: string][] = [
  ['text', 'background', 'texte principal sur l’écran'],
  ['text', 'surface', 'texte principal sur une carte'],
  ['muted', 'background', 'texte secondaire sur l’écran'],
  ['muted', 'surface', 'texte secondaire, indications des champs'],
  ['muted', 'border', 'segment non choisi (rail du sélecteur)'],
  ['text', 'primarySoft', 'texte sur une tuile claire'],
  ['text', 'warningSoft', 'texte sur une tuile « à vérifier »'],
  ['text', 'dangerSoft', 'texte sur une tuile « en retard »'],
  ['text', 'successSoft', 'texte sur une tuile « terminé »'],
  ['primary', 'background', 'lien sur l’écran'],
  ['primary', 'surface', 'bouton texte sur une carte'],
  ['primary', 'primarySoft', 'étiquette principale'],
  ['onPrimary', 'primary', 'bouton principal, carte « Prochain cours »'],
  ['warning', 'surface', 'texte « aujourd’hui »'],
  ['warning', 'warningSoft', 'étiquette « à vérifier »'],
  ['danger', 'surface', 'texte « en retard », « Supprimer »'],
  ['danger', 'background', 'erreur sous un champ'],
  ['danger', 'dangerSoft', 'étiquette « en retard »'],
  ['success', 'surface', 'texte « enregistré »'],
  ['success', 'background', 'montant d’une entrée d’argent, en haut de la saisie'],
  ['success', 'successSoft', 'étiquette « terminé »'],
  ['onPrimary', 'success', 'action « Terminer » en glissant'],
  ['onPrimary', 'warning', 'action « Reporter » en glissant'],
  ['onPrimary', 'danger', 'action destructive en glissant'],
  ['background', 'text', 'message bref (toast, couleurs inversées)'],
  ['primarySoft', 'text', 'bouton « Annuler » du toast'],
  ['muted', 'disabled', 'libellé d’un bouton désactivé'],
  ['text', 'warningSoft', 'carte Argent « découvert » : libellé et phrase'],
  ['warning', 'warningSoft', 'carte Argent « découvert » : montant du solde'],
  ['primary', 'primarySoft', 'pastille « Aujourd’hui » de la période'],
];

/** Commandes et icônes : contraste d'au moins 3:1 avec ce qui les entoure. */
const uiPairs: [fg: Token, bg: Token, where: string][] = [
  ['outline', 'surface', 'contour d’un champ, interrupteur éteint'],
  ['outline', 'background', 'contour d’un champ posé sur l’écran'],
  ['primary', 'surface', 'bouton principal sur une carte'],
  ['primary', 'background', 'bouton + et bouton principal'],
  ['success', 'surface', 'interrupteur allumé, case cochée'],
  ['surface', 'success', 'coche dans une case cochée'],
  ['muted', 'surface', 'case à cocher vide, icônes'],
  ['danger', 'surface', 'bordure d’un champ en erreur'],
  ['text', 'primarySoft', 'barre « il te reste » : remplissage sur son rail'],
  ['primarySoft', 'primary', 'barre « il te reste » : rail sur la carte principale'],
  ['warning', 'warningSoft', 'carte Argent « découvert » : icône d’alerte'],
  ['warning', 'background', 'carte Argent « découvert » : bordure sur l’écran'],
  ['success', 'successSoft', 'icône de la tuile « Entrées »'],
  ['danger', 'dangerSoft', 'icône de la tuile « Dépenses »'],
  ['primary', 'primarySoft', 'icône de la tuile « Épargne »'],
  ['warning', 'warningSoft', 'icône de la tuile « Prêté »'],
];

describe.each(
  (['light', 'dark'] as const).flatMap((scheme) => accentIds.map((a) => [scheme, a] as const)),
)('contraste WCAG AA — mode %s, couleur %s', (scheme, accent) => {
  const { colors } = getTheme(scheme, accent);
  it.each(textPairs)('texte %s sur %s (%s) ≥ 4,5:1', (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(AA);
  });
  it.each(uiPairs)('commande %s sur %s (%s) ≥ 3:1', (fg, bg) => {
    expect(contrast(colors[fg], colors[bg])).toBeGreaterThanOrEqual(AA_UI);
  });
});

describe('ombres en mode sombre', () => {
  it('ne sont jamais claires (une ombre claire ferait un halo autour du bouton)', () => {
    expect(luminance(darkColors.shadow)).toBeLessThan(0.05);
    expect(luminance(lightColors.shadow)).toBeLessThan(0.05);
  });
});

describe.each([
  ['clair', lightColors],
  ['sombre', darkColors],
])('couleurs — mode %s', (_name, c) => {
  it('texte principal lisible sur le fond et les cartes', () => {
    expect(contrast(c.text, c.background)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.text, c.surface)).toBeGreaterThanOrEqual(AA);
  });

  it('texte secondaire lisible sur le fond et les cartes', () => {
    expect(contrast(c.muted, c.background)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.muted, c.surface)).toBeGreaterThanOrEqual(AA);
  });

  it('texte lisible sur la couleur principale', () => {
    expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(AA);
  });

  it('couleurs d’état lisibles sur leur fond clair', () => {
    expect(contrast(c.warning, c.warningSoft)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.danger, c.dangerSoft)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.success, c.successSoft)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.primary, c.primarySoft)).toBeGreaterThanOrEqual(AA);
  });
});

it('le mode sombre définit exactement les mêmes couleurs que le mode clair', () => {
  expect(Object.keys(darkColors).sort()).toEqual(Object.keys(lightColors).sort());
});

describe('couleurs des matières', () => {
  it('ont des identifiants uniques', () => {
    const ids = subjectColors.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(subjectColors.map((s) => [s.id, s] as const))(
    '%s est lisible en clair et en sombre',
    (_id, s) => {
      expect(contrast(s.strong, s.soft)).toBeGreaterThanOrEqual(AA);
      expect(contrast(s.strongDark, s.softDark)).toBeGreaterThanOrEqual(AA);
    },
  );
});

describe.each(Object.entries(accentColors))('couleur principale %s', (_id, a) => {
  it.each([
    ['clair', a.light, lightColors],
    ['sombre', a.dark, darkColors],
  ])('lisible en mode %s', (_mode, c, base) => {
    expect(contrast(c.onPrimary, c.primary)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.primary, c.primarySoft)).toBeGreaterThanOrEqual(AA);
    // La couleur principale sert aussi de texte (liens, boutons texte) sur le fond et les cartes.
    expect(contrast(c.primary, base.background)).toBeGreaterThanOrEqual(AA);
    expect(contrast(c.primary, base.surface)).toBeGreaterThanOrEqual(AA);
  });
});
