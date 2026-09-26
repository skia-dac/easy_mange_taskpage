/**
 * Point unique pour les journaux (logs).
 *
 * Règles :
 * - ne jamais y mettre de données personnelles (contenu des notes, emails, mots de passe…) ;
 * - en production, rien n'est affiché dans la console. Un service de suivi des erreurs
 *   pourra être branché ici plus tard.
 */
type Context = Record<string, string | number | boolean | undefined>;

export const logger = {
  warn(message: string, context?: Context): void {
    if (__DEV__) console.warn(`[MySky] ${message}`, context ?? '');
  },
  error(error: unknown, context?: Context): void {
    if (__DEV__) console.error('[MySky]', error, context ?? '');
  },
};
