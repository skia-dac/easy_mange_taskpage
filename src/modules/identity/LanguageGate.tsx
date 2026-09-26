import { useEffect } from 'react';

import { useDb } from '@/shared/db';
import { detectLanguage, i18n } from '@/shared/i18n';

import { getLanguagePreference } from './data/settings';

/** Composant sans affichage : applique la langue choisie dans les réglages au démarrage. */
export function LanguageGate() {
  const db = useDb();
  useEffect(() => {
    void getLanguagePreference(db).then((pref) => {
      const target = pref === 'auto' ? detectLanguage() : pref;
      if (i18n.language !== target) void i18n.changeLanguage(target);
    });
  }, [db]);
  return null;
}
