import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import fr from './locales/fr.json';

export const supportedLanguages = ['fr', 'en'] as const;
export type Language = (typeof supportedLanguages)[number];
export const defaultLanguage: Language = 'fr';

export const resources = { fr: { translation: fr }, en: { translation: en } } as const;

/** Langue du téléphone si elle est prise en charge, sinon le français. */
export function detectLanguage(): Language {
  const code = getLocales()[0]?.languageCode ?? defaultLanguage;
  return (supportedLanguages as readonly string[]).includes(code)
    ? (code as Language)
    : defaultLanguage;
}

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources,
  lng: detectLanguage(),
  fallbackLng: defaultLanguage,
  interpolation: { escapeValue: false }, // React échappe déjà le texte
});

export { i18n };
