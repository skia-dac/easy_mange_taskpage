import { calendarStep, quickAddDay } from './calendar';

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

describe('quickAddDay : le jour des ajouts du « + »', () => {
  it('vues Jour, Semaine, Mois : le jour choisi', () => {
    expect(quickAddDay('day', '2026-11-12', '2026-11-09', '2026-11-08')).toBe('2026-11-12');
    expect(quickAddDay('month', '2026-12-01', '2026-11-30', '2026-11-08')).toBe('2026-12-01');
  });

  it('vue Heures : aujourd’hui s’il est dans la semaine affichée, sinon son premier jour', () => {
    expect(quickAddDay('hours', '2026-11-12', '2026-11-02', '2026-11-08')).toBe('2026-11-08');
    expect(quickAddDay('hours', '2026-11-12', '2026-11-09', '2026-11-08')).toBe('2026-11-09');
  });
});
