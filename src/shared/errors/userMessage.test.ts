import { AppError } from './AppError';
import { userMessageKey } from './userMessage';

describe('userMessageKey', () => {
  it('donne un message clair pour chaque erreur connue', () => {
    expect(userMessageKey(new AppError('network'))).toBe('errors.network');
    expect(userMessageKey(new AppError('saveFailed'))).toBe('errors.saveFailed');
  });

  it('préfère la clé précise portée par l’erreur quand il y en a une', () => {
    const e = new AppError('validation', 'jour off', { messageKey: 'calendar.moveOnDayOff' });
    expect(userMessageKey(e)).toBe('calendar.moveOnDayOff');
  });

  it('ne montre jamais le message technique d’une erreur inconnue', () => {
    expect(userMessageKey(new Error('HTTP 500 Internal Server Error'))).toBe('errors.generic');
    expect(userMessageKey('boom')).toBe('errors.generic');
    expect(userMessageKey(undefined)).toBe('errors.generic');
  });
});
