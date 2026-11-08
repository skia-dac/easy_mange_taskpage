import { i18n } from '@/shared/i18n';

import { setMoneyLocale } from './domain/money';

/** Les montants suivent la langue de l'app, au démarrage et à chaque changement. */
setMoneyLocale(i18n.language ?? 'fr');
i18n.on('languageChanged', (language: string) => setMoneyLocale(language));
