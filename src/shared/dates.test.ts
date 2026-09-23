import {
  addDaysIso,
  atTime,
  daysBetween,
  isIsoDate,
  isoWeekday,
  isTime,
  startOfIsoWeek,
  timeToMinutes,
  toIsoDate,
} from './dates';

describe('dates', () => {
  it('reconnaît les dates valides et refuse les autres', () => {
    expect(isIsoDate('2026-09-23')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('23/09/2026')).toBe(false);
  });

  it('reconnaît les heures valides', () => {
    expect(isTime('08:00')).toBe(true);
    expect(isTime('23:59')).toBe(true);
    expect(isTime('24:00')).toBe(false);
    expect(isTime('8:00')).toBe(false);
  });

  it('calcule le jour de la semaine (1 = lundi)', () => {
    expect(isoWeekday('2026-09-21')).toBe(1);
    expect(isoWeekday('2026-09-23')).toBe(3);
    expect(isoWeekday('2026-09-27')).toBe(7);
  });

  it('ajoute des jours, y compris en changeant de mois et d’heure d’été', () => {
    expect(addDaysIso('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDaysIso('2026-10-24', 7)).toBe('2026-10-31');
    expect(addDaysIso('2026-10-24', 8)).toBe('2026-11-01');
  });

  it('compte les jours entre deux dates', () => {
    expect(daysBetween('2026-09-23', '2026-10-12')).toBe(19);
    expect(daysBetween('2026-09-23', '2026-09-23')).toBe(0);
    expect(daysBetween('2026-09-23', '2026-09-22')).toBe(-1);
  });

  it('trouve le lundi de la semaine', () => {
    expect(startOfIsoWeek('2026-09-23')).toBe('2026-09-21');
    expect(startOfIsoWeek('2026-09-27')).toBe('2026-09-21');
  });

  it('convertit heures et dates', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(toIsoDate(atTime('2026-09-23', '09:30'))).toBe('2026-09-23');
    expect(atTime('2026-09-23', '09:30').getHours()).toBe(9);
  });
});
