import { useRef, useState } from 'react';

import { userMessageKey } from '../errors';
import { haptic } from './haptics';
import { logger } from '../logger';
import { isValidationError, type FieldErrors } from '../validation';
import { showError } from './dialogs';

/**
 * Gère l'enregistrement d'un formulaire :
 * - erreurs de saisie → affichées sous chaque champ ;
 * - autre erreur → message clair, les données saisies restent à l'écran ;
 * - réussite → un léger retour tactile « enregistré ». Une action qui échoue sans lever
 *   d'erreur (elle a déjà prévenu l'utilisateur) rend `false` : aucun retour « réussi ».
 * Un seul enregistrement à la fois : un double appui sur « Enregistrer » (deux appuis dans la même
 * image, avant que l'état `saving` soit rendu) ne crée jamais de doublon. Le second appel rend
 * `undefined`, comme un échec : l'appelant ne revient donc en arrière qu'une fois.
 */
/** `messageKey` : traduction d'une erreur non liée à un champ (par défaut `userMessageKey`). */
export function useSave(messageKey: (error: unknown) => string = userMessageKey) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  // Lu et écrit de façon synchrone : l'état React n'est à jour qu'au rendu suivant.
  const inFlight = useRef(false);

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setSaving(true);
    // Les erreurs d'un essai précédent disparaissent dès le nouvel essai.
    setErrors({});
    try {
      const result = await action();
      if (result !== false) haptic('success');
      return result;
    } catch (error) {
      if (isValidationError(error)) {
        setErrors(error.fields);
      } else {
        logger.error(error, { where: 'useSave' });
        showError(messageKey(error));
      }
      return undefined;
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return { errors, saving, run, setErrors };
}
