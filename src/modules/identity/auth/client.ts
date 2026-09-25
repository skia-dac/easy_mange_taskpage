import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { accountsConfigured, env } from '@/shared/config/env';

import { secureSessionStorage } from './secureStorage';

let client: SupabaseClient | null = null;

/**
 * Client Supabase, créé seulement si le projet est configuré (URL + clé publique).
 * Sans configuration, l'app fonctionne entièrement sans compte.
 */
export function getSupabase(): SupabaseClient | null {
  if (!accountsConfigured()) return null;
  if (client) return client;
  client = createClient(env.supabaseUrl!, env.supabaseAnonKey!, {
    auth: {
      storage: secureSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  // Rafraîchissement du jeton seulement quand l'app est au premier plan (recommandation Supabase).
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void client?.auth.startAutoRefresh();
    else void client?.auth.stopAutoRefresh();
  });
  return client;
}
