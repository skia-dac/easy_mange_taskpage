import { formatLongDate } from './format';

describe('formatLongDate', () => {
  const date = new Date(2026, 8, 23); // 23 septembre 2026, un mercredi

  it('formate en français avec une majuscule', () => {
    expect(formatLongDate(date, 'fr')).toBe('Mercredi 23 septembre');
  });

  it('formate en anglais', () => {
    expect(formatLongDate(date, 'en')).toBe('Wednesday, September 23');
  });
});
