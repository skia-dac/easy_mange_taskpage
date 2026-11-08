import { amountPadMode } from './amountPadLayout';

const mode = (windowHeight: number, scale: number, hasDelete = false) =>
  amountPadMode({ windowHeight, scale, hasDelete, bottomInset: windowHeight > 700 ? 34 : 0 });

describe('pied de la saisie d’une opération', () => {
  it('grand téléphone, texte normal : grand pavé fixe', () => {
    expect(mode(844, 1)).toBe('regular');
  });

  it('iPhone SE : pavé compact, il reste de la place pour défiler', () => {
    expect(mode(667, 1)).toBe('compact');
  });

  it('texte à 200 % sur un grand téléphone : pavé compact', () => {
    expect(mode(844, 2)).toBe('compact');
  });

  it('iPhone SE à 200 % : compact pour une nouvelle opération, tout défile avec Supprimer', () => {
    expect(mode(667, 2)).toBe('compact');
    expect(mode(667, 2, true)).toBe('inline');
  });

  it('très petit écran : tout défile, sauf Enregistrer', () => {
    expect(mode(568, 1.3, true)).toBe('inline');
    expect(mode(568, 2)).toBe('inline');
  });
});
