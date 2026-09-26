import { authErrorKey } from '../domain/auth';
import {
  AccountError,
  completeFromUrl,
  deleteRemoteAccount,
  signInWithProvider,
  signUp,
} from './service';

/** Client Supabase simulé : chaque test règle les réponses dont il a besoin. */
const mockAuth = {
  signUp: jest.fn(),
  exchangeCodeForSession: jest.fn(),
  getSession: jest.fn(),
  signInWithOAuth: jest.fn(),
};
const mockFunctions = { invoke: jest.fn() };
jest.mock('./client', () => ({
  getSupabase: () => ({ auth: mockAuth, functions: mockFunctions }),
}));

const mockBrowser = { openAuthSessionAsync: jest.fn() };
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: (...args: unknown[]) => mockBrowser.openAuthSessionAsync(...args),
}));

jest.mock('expo-linking', () => ({
  createURL: (path: string) => `mysky://${path}`,
  parse: (url: string) => {
    const u = new URL(url);
    return { queryParams: Object.fromEntries(u.searchParams.entries()) };
  },
}));

async function keyOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(AccountError);
    return (e as AccountError).message;
  }
  throw new Error('aucune erreur levée');
}

const signUpInput = {
  email: 'yvan@example.com',
  password: 'motdepasse1',
  confirm: 'motdepasse1',
};

beforeEach(() => jest.clearAllMocks());

describe('inscription', () => {
  it('adresse déjà utilisée : réponse sans erreur mais identités vides → emailTaken', async () => {
    mockAuth.signUp.mockResolvedValue({
      data: { user: { id: 'u', identities: [] }, session: null },
      error: null,
    });
    expect(await keyOf(signUp(signUpInput))).toBe('auth.error.emailTaken');
  });

  it('nouveau compte : confirmation attendue tant qu’aucune session n’est ouverte', async () => {
    mockAuth.signUp.mockResolvedValue({
      data: { user: { id: 'u', identities: [{ id: 'i' }] }, session: null },
      error: null,
    });
    expect(await signUp(signUpInput)).toEqual({ needsConfirmation: true });
    mockAuth.signUp.mockResolvedValue({
      data: { user: { id: 'u', identities: [{ id: 'i' }] }, session: { access_token: 't' } },
      error: null,
    });
    expect(await signUp(signUpInput)).toEqual({ needsConfirmation: false });
  });

  it('erreur Supabase traduite en clé, jamais le message technique', async () => {
    mockAuth.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'weak_password', status: 422, message: 'Password should be…' },
    });
    expect(await keyOf(signUp(signUpInput))).toBe('auth.error.passwordWeak');
  });
});

describe('retour par lien (completeFromUrl)', () => {
  it('code déjà utilisé mais session déjà ouverte : pas d’erreur', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({ error: { code: 'flow_state_not_found' } });
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
    await expect(completeFromUrl('mysky://auth/callback?code=abc')).resolves.toBeUndefined();
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
  });

  it('code déjà utilisé sans session : lien expiré', async () => {
    mockAuth.exchangeCodeForSession.mockResolvedValue({ error: { code: 'flow_state_not_found' } });
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    expect(await keyOf(completeFromUrl('mysky://auth/callback?code=abc'))).toBe(
      'auth.error.linkExpired',
    );
  });

  it('erreur dans l’adresse ou code absent', async () => {
    expect(await keyOf(completeFromUrl('mysky://auth/callback?error_code=otp_expired'))).toBe(
      'auth.error.linkExpired',
    );
    expect(await keyOf(completeFromUrl('mysky://auth/callback'))).toBe('auth.error.linkExpired');
    expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});

describe('connexion Google / Apple', () => {
  beforeEach(() => {
    mockAuth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://example.supabase.co/authorize' },
      error: null,
    });
  });

  it('annulée par l’utilisateur : false, aucune session échangée', async () => {
    mockBrowser.openAuthSessionAsync.mockResolvedValue({ type: 'cancel' });
    expect(await signInWithProvider('google')).toBe(false);
    expect(mockAuth.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it('réussie : le code du retour est échangé', async () => {
    mockBrowser.openAuthSessionAsync.mockResolvedValue({
      type: 'success',
      url: 'mysky://auth/callback?code=xyz',
    });
    mockAuth.exchangeCodeForSession.mockResolvedValue({ error: null });
    expect(await signInWithProvider('apple')).toBe(true);
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith('xyz');
  });

  it('pas d’adresse d’autorisation : erreur générique', async () => {
    mockAuth.signInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });
    expect(await keyOf(signInWithProvider('google'))).toBe('errors.generic');
    expect(mockBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  });
});

describe('suppression du compte sur le serveur', () => {
  it('réussie', async () => {
    mockFunctions.invoke.mockResolvedValue({ data: { ok: true }, error: null });
    await expect(deleteRemoteAccount()).resolves.toBeUndefined();
    expect(mockFunctions.invoke).toHaveBeenCalledWith('delete-account', { method: 'POST' });
  });

  it('401 : session expirée (se reconnecter), distinct d’un échec réseau ou serveur', async () => {
    mockFunctions.invoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsHttpError', context: { status: 401 } },
    });
    expect(await keyOf(deleteRemoteAccount())).toBe('auth.sessionExpired');

    mockFunctions.invoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsFetchError', context: new TypeError('Network request failed') },
    });
    expect(await keyOf(deleteRemoteAccount())).toBe('errors.network');

    mockFunctions.invoke.mockResolvedValue({
      data: null,
      error: { name: 'FunctionsHttpError', context: { status: 500 } },
    });
    expect(await keyOf(deleteRemoteAccount())).toBe('auth.error.deleteFailed');
  });
});

describe('authErrorKey (table de correspondance)', () => {
  it.each([
    [{ code: 'invalid_credentials' }, 'auth.error.invalidCredentials'],
    [{ code: 'email_not_confirmed' }, 'auth.error.emailNotConfirmed'],
    [{ code: 'user_already_exists' }, 'auth.error.emailTaken'],
    [{ code: 'email_exists' }, 'auth.error.emailTaken'],
    [{ code: 'weak_password' }, 'auth.error.passwordWeak'],
    [{ code: 'email_address_invalid' }, 'auth.error.emailInvalid'],
    [{ code: 'over_email_send_rate_limit' }, 'auth.error.tooMany'],
    [{ code: 'over_request_rate_limit' }, 'auth.error.tooMany'],
    [{ code: 'same_password' }, 'auth.error.samePassword'],
    [{ code: 'flow_state_expired' }, 'auth.error.linkExpired'],
    [{ code: 'flow_state_not_found' }, 'auth.error.linkExpired'],
    [{ code: 'bad_code_verifier' }, 'auth.error.linkExpired'],
    [{ code: 'otp_expired' }, 'auth.error.linkExpired'],
    [{ name: 'AuthRetryableFetchError' }, 'errors.network'],
    [{ status: 0 }, 'errors.network'],
    [{ code: 'something_new' }, 'errors.generic'],
    [{}, 'errors.generic'],
    [null, 'errors.generic'],
    [undefined, 'errors.generic'],
  ])('%j → %s', (error, key) => {
    expect(authErrorKey(error)).toBe(key);
  });

  it('chaque clé renvoyée existe en français et en anglais', () => {
    const fr = require('@/shared/i18n/locales/fr.json');
    const en = require('@/shared/i18n/locales/en.json');
    const keys = [
      'auth.error.invalidCredentials',
      'auth.error.emailNotConfirmed',
      'auth.error.emailTaken',
      'auth.error.passwordWeak',
      'auth.error.emailInvalid',
      'auth.error.tooMany',
      'auth.error.samePassword',
      'auth.error.linkExpired',
      'auth.error.deleteFailed',
      'auth.sessionExpired',
      'errors.network',
      'errors.generic',
    ];
    const get = (o: Record<string, unknown>, k: string) =>
      k.split('.').reduce<unknown>((a, p) => (a as Record<string, unknown>)?.[p], o);
    for (const k of keys) {
      expect(typeof get(fr, k)).toBe('string');
      expect(typeof get(en, k)).toBe('string');
    }
  });
});
