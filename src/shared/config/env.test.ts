import { parseEnv } from './env';

describe('parseEnv', () => {
  it('accepte une configuration vide (phase 0, pas encore de serveur)', () => {
    expect(parseEnv({})).toEqual({ supabaseUrl: undefined, supabaseAnonKey: undefined });
  });

  it('accepte une URL https', () => {
    expect(parseEnv({ EXPO_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co' }).supabaseUrl).toBe(
      'https://abc.supabase.co',
    );
  });

  it('refuse une URL non chiffrée (http)', () => {
    expect(() => parseEnv({ EXPO_PUBLIC_SUPABASE_URL: 'http://abc.supabase.co' })).toThrow();
  });
});
