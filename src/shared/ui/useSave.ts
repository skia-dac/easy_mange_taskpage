import { useState } from 'react';

import { userMessageKey } from '../errors';
import { logger } from '../logger';
import { isValidationError, type FieldErrors } from '../validation';
import { showError } from './dialogs';

/**
 * Gère l'enregistrement d'un formulaire :
 * - erreurs de saisie → affichées sous chaque champ ;
 * - autre erreur → message clair, les données saisies restent à l'écran.
 */
export function useSave() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (saving) return undefined;
    setSaving(true);
    try {
      const result = await action();
      setErrors({});
      return result;
    } catch (error) {
      if (isValidationError(error)) {
        setErrors(error.fields);
      } else {
        logger.error(error, { where: 'useSave' });
        showError(userMessageKey(error));
      }
      return undefined;
    } finally {
      setSaving(false);
    }
  }

  return { errors, saving, run, setErrors };
}
