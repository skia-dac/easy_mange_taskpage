import { checkInput, fieldLimits, isAcademicYear, limitInput, moneyLimit } from './fieldLimits';

describe('limites de saisie', () => {
  it('coupe un texte à sa longueur maximale', () => {
    expect(limitInput('a'.repeat(100), fieldLimits.name60)).toHaveLength(40);
  });

  it('un e-mail perd ses espaces et refuse une adresse incomplète', () => {
    expect(limitInput('ada @school.fr', fieldLimits.email)).toBe('ada@school.fr');
    expect(checkInput('ada@school.fr', fieldLimits.email)).toBeNull();
    expect(checkInput('ada', fieldLimits.email)).toBe('auth.error.emailInvalid');
    expect(checkInput('', fieldLimits.email)).toBeNull();
  });

  it('un mot de passe nouveau exige 8 caractères, une lettre et un chiffre', () => {
    expect(limitInput('x'.repeat(80), fieldLimits.newPassword)).toHaveLength(72);
    expect(checkInput('court1', fieldLimits.newPassword)).toBe('auth.error.passwordShort');
    expect(checkInput('sanschiffre', fieldLimits.newPassword)).toBe('auth.error.passwordWeak');
    expect(checkInput('mysky2026', fieldLimits.newPassword)).toBeNull();
    expect(checkInput('ancien', fieldLimits.password)).toBeNull();
  });

  it('un code de matière ne garde que lettres, chiffres et tiret', () => {
    expect(limitInput('mkt 101!', fieldLimits.code)).toBe('MKT 101');
  });

  it('une durée ne dépasse pas 24 heures et refuse 0', () => {
    expect(limitInput('99999', fieldLimits.duration)).toBe('99');
    expect(limitInput('12a', fieldLimits.duration)).toBe('12');
    expect(checkInput('0', fieldLimits.duration)).toBe('validation.invalidDuration');
    expect(checkInput('90', fieldLimits.duration)).toBeNull();
  });

  it('une note et un coefficient restent dans leur barème', () => {
    expect(limitInput('14,5', fieldLimits.grade)).toBe('14,5');
    expect(limitInput('100000', fieldLimits.grade)).toBe('100');
    expect(checkInput('0', fieldLimits.gradeMax)).toBe('validation.invalidGrade');
    expect(checkInput('150', fieldLimits.coefficient)).toBe('validation.invalidCoefficient');
    expect(checkInput('2', fieldLimits.coefficient)).toBeNull();
  });

  it('un poids est entre 20 et 400 kg, avec une décimale', () => {
    expect(limitInput('72,4kg', fieldLimits.weight)).toBe('72,4');
    expect(checkInput('19', fieldLimits.weight)).toBe('validation.invalidWeight');
    expect(checkInput('72.4', fieldLimits.weight)).toBeNull();
  });

  it('un montant refuse les lettres, les centimes en trop et zéro', () => {
    const fcfa = moneyLimit(0);
    const euro = moneyLimit(2);
    expect(limitInput('12 500f', fcfa)).toBe('12500');
    expect(limitInput('12,509', euro)).toBe('12,50');
    expect(checkInput('0', euro)).toBe('money.invalidAmount');
    expect(checkInput('12,5', euro)).toBeNull();
  });

  it('une année scolaire est deux années qui se suivent', () => {
    expect(isAcademicYear('2026-2027')).toBe(true);
    expect(isAcademicYear('2026–2027')).toBe(true);
    expect(isAcademicYear('2027-2026')).toBe(false);
    expect(isAcademicYear('L3')).toBe(false);
    expect(checkInput('2026', fieldLimits.academicYear)).toBe('validation.invalidYear');
  });
});
