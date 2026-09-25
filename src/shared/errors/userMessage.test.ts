import { AppError } from './AppError';
import { userMessageKey } from './userMessage';

describe('userMessageKey', () => {
  it('donne un message clair pour chaque erreur connue', () => {
    expect(userMessageKey(new AppError('network'))).toBe('errors.network');
    expect(userMessageKey(new AppError('saveFailed'))).toBe('errors.saveFailed');
  });

  it('ne montre jamais le message technique d’une erreur inconnue', () => {
    expect(userMessageKey(new Error('HTTP 500 Internal Server Error'))).toBe('errors.generic');
    expect(userMessageKey('boom')).toBe('errors.generic');
    expect(userMessageKey(undefined)).toBe('errors.generic');
  });
});
