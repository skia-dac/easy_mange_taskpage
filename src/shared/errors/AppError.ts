/** Types d'erreurs connus de l'app. Chaque code a un message compréhensible (voir userMessage). */
export type AppErrorCode = 'network' | 'saveFailed' | 'notFound' | 'validation' | 'unknown';

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message?: string, options?: { cause?: unknown }) {
    super(message ?? code, options);
    this.name = 'AppError';
    this.code = code;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
