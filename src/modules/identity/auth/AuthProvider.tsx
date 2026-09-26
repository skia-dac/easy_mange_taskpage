import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { i18n } from '@/shared/i18n';
import { showToast } from '@/shared/ui';

import { getSupabase } from './client';
import { takeExplicitSignOut } from './service';

export type AuthState = {
  /** Comptes disponibles dans cette version (projet Supabase configuré). */
  enabled: boolean;
  loading: boolean;
  session: Session | null;
  userId: string | null;
  email: string | null;
};

const AuthContext = createContext<AuthState>({
  enabled: false,
  loading: false,
  session: null,
  userId: null,
  email: null,
});

/** Suit la session de connexion (restaurée au lancement, rafraîchie, déconnectée). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(client !== null);

  useEffect(() => {
    if (!client) return;
    let active = true;
    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = client.auth.onAuthStateChange((event, next) => {
      // Déconnexion que l'app n'a pas demandée (jeton expiré ou révoqué) : on prévient.
      if (event === 'SIGNED_OUT' && !takeExplicitSignOut())
        showToast(i18n.t('auth.sessionExpired'));
      setSession(next);
      setLoading(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [client]);

  const value = useMemo<AuthState>(
    () => ({
      enabled: client !== null,
      loading,
      session,
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
    }),
    [client, loading, session],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
