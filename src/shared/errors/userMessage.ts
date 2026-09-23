import { isAppError, type AppErrorCode } from './AppError';

const keyByCode: Record<AppErrorCode, string> = {
  network: 'errors.network',
  saveFailed: 'errors.saveFailed',
  notFound: 'errors.notFound',
  validation: 'errors.generic',
  unknown: 'errors.generic',
};

/**
 * Transforme n'importe quelle erreur en clé de traduction affichable.
 * On n'affiche jamais le message technique (ex. « Error 500 ») à l'utilisateur.
 */
export function userMessageKey(error: unknown): string {
  return isAppError(error) ? keyByCode[error.code] : keyByCode.unknown;
}
