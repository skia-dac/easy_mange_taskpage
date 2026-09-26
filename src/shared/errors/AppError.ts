/** Types d'erreurs connus de l'app. Chaque code a un message compréhensible (voir userMessage). */
export type AppErrorCode = 'network' | 'saveFailed' | 'notFound' | 'validation' | 'unknown';

export class AppError extends Error {
  readonly code: AppErrorCode;
  /** Clé de traduction plus précise que celle du code (ex. `calendar.moveOnDayOff`). */
  readonly messageKey: string | undefined;

  constructor(
    code: AppErrorCode,
    message?: string,
    options?: { cause?: unknown; messageKey?: string },
  ) {
    super(message ?? code, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.messageKey = options?.messageKey;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
