import { accentColors, darkColors, lightColors, subjectColors } from './colors';

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
