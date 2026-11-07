import { calendarStep } from './calendar';

describe('calendarStep', () => {
  it('vue Jour : un jour à la fois', () => {
    expect(calendarStep('day', '2026-11-07', 1)).toBe('2026-11-08');
    expect(calendarStep('day', '2026-11-01', -1)).toBe('2026-10-31');
  });

  it('vues Semaine et Heures : sept jours', () => {
    expect(calendarStep('week', '2026-11-07', 1)).toBe('2026-11-14');
    expect(calendarStep('hours', '2026-11-07', -1)).toBe('2026-10-31');
  });

  it('vue Mois : le 1er du mois voisin, même depuis le 31', () => {
    expect(calendarStep('month', '2026-01-31', 1)).toBe('2026-02-01');
    expect(calendarStep('month', '2026-01-15', -1)).toBe('2025-12-01');
  });
});
