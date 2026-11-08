import { accountBackupMode } from './useAccountBackup';

const base = { enabled: true, authLoading: false, userId: 'u1', owner: 'u1' as string | null };

describe('où sont les données (Réglages › Mes données)', () => {
  it('connecté et propriétaire : sauvegardées sur le compte', () => {
    expect(accountBackupMode(base)).toBe('account');
    // Pas encore relié : AccountGate le relie tout de suite au compte connecté.
    expect(accountBackupMode({ ...base, owner: null })).toBe('account');
  });

  it('sans compte : seulement sur ce téléphone', () => {
    expect(accountBackupMode({ ...base, userId: null, owner: null })).toBe('signedOut');
    // Déconnecté en gardant les données : elles ne sont plus sauvegardées.
    expect(accountBackupMode({ ...base, userId: null })).toBe('signedOut');
  });

  it('comptes indisponibles dans cette version : dit honnêtement', () => {
    expect(accountBackupMode({ ...base, enabled: false, userId: null })).toBe('unavailable');
  });

  it('données d’un autre compte : pas sauvegardées sur le compte connecté', () => {
    expect(accountBackupMode({ ...base, owner: 'u2' })).toBe('otherAccount');
  });

  it('rien d’affirmé tant que la session ou le propriétaire sont en lecture', () => {
    expect(accountBackupMode({ ...base, authLoading: true })).toBe('loading');
    expect(accountBackupMode({ ...base, owner: undefined })).toBe('loading');
  });
});
