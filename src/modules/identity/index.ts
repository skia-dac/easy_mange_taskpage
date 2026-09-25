// Module identity : profil, préférences (compte : phase 2).
// Point d'entrée unique du module : les autres parties de l'app importent uniquement depuis ce fichier.
export * from './data/profile';
export * from './data/settings';
export * from './domain/preferences';
export * from './domain/profile';
export { LanguageGate } from './LanguageGate';
export { AppearanceProvider } from './AppearanceProvider';
export { SpacesProvider } from './SpacesProvider';
export * from './domain/auth';
export { getSupabase } from './auth/client';
export { AuthProvider, useAuth } from './auth/AuthProvider';
export type { AuthState } from './auth/AuthProvider';
export {
  AccountError,
  accountMessageKey,
  completeFromUrl,
  deleteRemoteAccount,
  redirectUrl,
  sendPasswordReset,
  signIn,
  signInWithProvider,
  signOut,
  signUp,
  updatePassword,
} from './auth/service';
