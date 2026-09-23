/** « mardi 23 septembre » → « Mardi 23 septembre », selon la langue. */
export function formatLongDate(date: Date, locale: string): string {
  const text = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
  return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}
