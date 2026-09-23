import { z } from 'zod';

/**
 * Variables de configuration, vérifiées au démarrage.
 * Toutes les variables EXPO_PUBLIC_* sont visibles dans l'app : jamais de secret ici.
 */
const schema = z.object({
  supabaseUrl: z.url().startsWith('https://').optional(),
  supabaseAnonKey: z.string().min(1).optional(),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const clean = (v: string | undefined) => (v && v.trim() !== '' ? v.trim() : undefined);
  return schema.parse({
    supabaseUrl: clean(raw.EXPO_PUBLIC_SUPABASE_URL),
    supabaseAnonKey: clean(raw.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  });
}

// Les variables doivent être lues une par une (process.env.EXPO_PUBLIC_X) pour être incluses par Expo.
export const env: Env = parseEnv({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
});
