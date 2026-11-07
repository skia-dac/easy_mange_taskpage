import { useState } from 'react';

import { userMessageKey } from '../errors';
import { haptic } from '../haptics';
import { logger } from '../logger';
import { isValidationError, type FieldErrors } from '../validation';
import { showError } from './dialogs';

/**
 * Gère l'enregistrement d'un formulaire :
 * - erreurs de saisie → affichées sous chaque champ ;
 * - autre erreur → message clair, les données saisies restent à l'écran ;
 * - réussite → un léger retour tactile « enregistré ».
 */
/** `messageKey` : traduction d'une erreur non liée à un champ (par défaut `userMessageKey`). */
export function useSave(messageKey: (error: unknown) => string = userMessageKey) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (saving) return undefined;
    setSaving(true);
    // Les erreurs d'un essai précédent disparaissent dès le nouvel essai.
    setErrors({});
    try {
      const result = await action();
      haptic('success');
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
      setSaving(false);
    }
  }

  return { errors, saving, run, setErrors };
}
