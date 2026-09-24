import { z } from 'zod';

import { optionalText } from '@/shared/validation';

/** Règles du compte (spécification §5.1) : e-mail valide, mot de passe d'au moins 8 caractères avec lettre et chiffre. */
export const emailSchema = z
  .string({ error: 'validation.required' })
  .trim()
  .toLowerCase()
  .min(1, { error: 'validation.required' })
  .max(254, { error: 'validation.tooLong' })
  .pipe(z.email({ error: 'auth.error.emailInvalid' }));

export const PASSWORD_MIN = 8;

export const passwordSchema = z
  .string({ error: 'validation.required' })
  .min(PASSWORD_MIN, { error: 'auth.error.passwordShort' })
  .max(72, { error: 'validation.tooLong' })
  .refine((p) => /[A-Za-zÀ-ÿ]/.test(p) && /\d/.test(p), { error: 'auth.error.passwordWeak' });

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string({ error: 'validation.required' }).min(1, { error: 'validation.required' }),
});

export const signUpSchema = z
  .object({
    firstName: optionalText(60),
    lastName: optionalText(60),
    email: emailSchema,
    password: passwordSchema,
    confirm: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirm)
      ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'auth.error.passwordMismatch' });
  });

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .superRefine((v, ctx) => {
    if (v.password !== v.confirm)
      ctx.addIssue({ code: 'custom', path: ['confirm'], message: 'auth.error.passwordMismatch' });
  });

export type SignInInput = z.input<typeof signInSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;
export type NewPasswordInput = z.input<typeof newPasswordSchema>;

export type OAuthProvider = 'google' | 'apple';

/**
 * Traduit une erreur Supabase Auth en clé de message compréhensible (jamais le message technique).
 * `code` suit https://supabase.com/docs/guides/auth/debugging/error-codes
 */
export function authErrorKey(
  error: { code?: string; status?: number; name?: string } | null | undefined,
): string {
  if (!error) return 'errors.generic';
  if (error.name === 'AuthRetryableFetchError' || error.status === 0) return 'errors.network';
  switch (error.code) {
    case 'invalid_credentials':
      return 'auth.error.invalidCredentials';
    case 'email_not_confirmed':
      return 'auth.error.emailNotConfirmed';
    case 'user_already_exists':
    case 'email_exists':
      return 'auth.error.emailTaken';
    case 'weak_password':
      return 'auth.error.passwordWeak';
    case 'email_address_invalid':
      return 'auth.error.emailInvalid';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'auth.error.tooMany';
    case 'same_password':
      return 'auth.error.samePassword';
    case 'flow_state_expired':
    case 'flow_state_not_found':
    case 'bad_code_verifier':
    case 'otp_expired':
      return 'auth.error.linkExpired';
    default:
      return 'errors.generic';
  }
}
