import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { AppError } from '@/shared/errors';
import { logger } from '@/shared/logger';
import { parseInput } from '@/shared/validation';

import {
  authErrorKey,
  emailSchema,
  newPasswordSchema,
  signInSchema,
  signUpSchema,
  type OAuthProvider,
  type NewPasswordInput,
  type SignInInput,
  type SignUpInput,
} from '../domain/auth';
import { getSupabase } from './client';

/** Erreur de compte : `message` est directement la clé de traduction à afficher. */
export class AccountError extends AppError {
  constructor(key: string, cause?: unknown) {
    super('validation', key, { cause });
    this.name = 'AccountError';
  }
}

export function accountMessageKey(error: unknown, fallback: (e: unknown) => string): string {
  return error instanceof AccountError ? error.message : fallback(error);
}

function requireClient() {
  const c = getSupabase();
  if (!c) throw new AccountError('auth.error.notConfigured');
  return c;
}

function fail(error: { code?: string; status?: number; name?: string }, where: string): never {
  logger.warn('Erreur de compte', { where, code: error.code ?? error.name ?? 'unknown' });
  throw new AccountError(authErrorKey(error), error);
}

/** Adresse de retour dans l'app après un lien reçu par e-mail ou une connexion Google / Apple. */
export function redirectUrl(path: 'auth/callback' | 'auth/reset'): string {
  return Linking.createURL(path);
}

export async function signIn(input: SignInInput): Promise<void> {
  const v = parseInput(signInSchema, input);
  const { error } = await requireClient().auth.signInWithPassword(v);
  if (error) fail(error, 'signIn');
}

/** Crée le compte. Retourne `needsConfirmation` si Supabase attend la confirmation de l'e-mail. */
export async function signUp(input: SignUpInput): Promise<{ needsConfirmation: boolean }> {
  const v = parseInput(signUpSchema, input);
  const { data, error } = await requireClient().auth.signUp({
    email: v.email,
    password: v.password,
    options: {
      emailRedirectTo: redirectUrl('auth/callback'),
      data: { first_name: v.firstName ?? '', last_name: v.lastName ?? '' },
    },
  });
  if (error) fail(error, 'signUp');
  // Adresse déjà utilisée : Supabase répond sans erreur mais avec une liste d'identités vide.
  if (data.user && data.user.identities && data.user.identities.length === 0)
    throw new AccountError('auth.error.emailTaken');
  return { needsConfirmation: !data.session };
}

export async function sendPasswordReset(email: string): Promise<void> {
  const v = parseInput(emailSchema, email);
  const { error } = await requireClient().auth.resetPasswordForEmail(v, {
    redirectTo: redirectUrl('auth/reset'),
  });
  if (error) fail(error, 'resetPassword');
}

export async function updatePassword(input: NewPasswordInput): Promise<void> {
  const v = parseInput(newPasswordSchema, input);
  const { error } = await requireClient().auth.updateUser({ password: v.password });
  if (error) fail(error, 'updatePassword');
}

/** Termine une connexion à partir de l'adresse de retour (code PKCE ou erreur). */
export async function completeFromUrl(url: string): Promise<void> {
  const parsed = Linking.parse(url);
  const params = parsed.queryParams ?? {};
  const code = typeof params.code === 'string' ? params.code : null;
  if (typeof params.error_code === 'string') fail({ code: params.error_code }, 'callback');
  if (!code) throw new AccountError('auth.error.linkExpired');
  const client = requireClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) {
    // Le code a peut-être déjà été utilisé (retour reçu deux fois) : la session existe alors déjà.
    const { data } = await client.auth.getSession();
    if (!data.session) fail(error, 'exchangeCode');
  }
}

/** Connexion Google ou Apple dans le navigateur sécurisé du téléphone. `false` si annulée. */
export async function signInWithProvider(provider: OAuthProvider): Promise<boolean> {
  const client = requireClient();
  const redirectTo = redirectUrl('auth/callback');
  const { data, error } = await client.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data.url) fail(error ?? {}, 'oauth');
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;
  await completeFromUrl(result.url);
  return true;
}

/** Déconnexion de ce téléphone seulement (les autres appareils restent connectés). */
export async function signOut(): Promise<void> {
  const c = getSupabase();
  if (!c) return;
  const { error } = await c.auth.signOut({ scope: 'local' });
  if (error) logger.warn('Déconnexion incomplète', { where: 'signOut' });
}

/** Supprime le compte sur le serveur (données et fichiers), via la fonction serveur delete-account. */
export async function deleteRemoteAccount(): Promise<void> {
  const client = requireClient();
  const { error } = await client.functions.invoke('delete-account', { method: 'POST' });
  if (error) {
    logger.error(error, { where: 'deleteRemoteAccount' });
    throw new AccountError('auth.error.deleteFailed', error);
  }
}
