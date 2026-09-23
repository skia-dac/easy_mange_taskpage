import { formatDuration, formatLongDate, weekdayName } from './format';

describe('formatLongDate', () => {
  const date = new Date(2026, 8, 23); // 23 septembre 2026, un mercredi

  it('formate en français avec une majuscule', () => {
    expect(formatLongDate(date, 'fr')).toBe('Mercredi 23 septembre');
  });

  it('formate en anglais', () => {
    expect(formatLongDate(date, 'en')).toBe('Wednesday, September 23');
  });
});

describe('autres formats', () => {
  it('durées', () => {
    expect(formatDuration(35)).toBe('35 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(80)).toBe('1 h 20');
  });

  it('jours de la semaine (1 = lundi)', () => {
    expect(weekdayName(1, 'fr')).toBe('lundi');
    expect(weekdayName(7, 'en')).toBe('Sunday');
  });
});
