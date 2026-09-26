import { createSubject } from '@/modules/academic';
import {
  AccountError,
  getAccountOwner,
  getProfile,
  isOnboardingDone,
  mergeDuplicateProfiles,
  saveProfile,
  setOnboardingDone,
} from '@/modules/identity';
import { createTestDb } from '@/test/memoryDb';

import {
  claimLocalData,
  deleteAccountEverywhere,
  fillProfileFromSignUp,
  replaceLocalDataWithAccount,
} from './account';
import * as wipeModule from './wipeAllData';

jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  cancelAllReminders: async () => undefined,
  deleteAllAttachments: () => undefined,
  deleteAllBackups: () => undefined,
}));

const mockRemote = { deleteRemoteAccount: jest.fn(), signOut: jest.fn() };
jest.mock('@/modules/identity', () => ({
  ...jest.requireActual('@/modules/identity'),
  deleteRemoteAccount: () => mockRemote.deleteRemoteAccount(),
  signOut: () => mockRemote.signOut(),
}));

/** Simule une ligne de profil reçue du serveur (déjà synchronisée, sans passer par la file d'envoi). */
async function receiveServerProfile(
  db: Awaited<ReturnType<typeof createTestDb>>,
  id: string,
  values: { first_name: string; last_name: string; university?: string | null },
) {
  await db.runAsync(
    `INSERT INTO profiles (id, created_at, updated_at, version, sync_status, first_name, last_name, university)
     VALUES (?, ?, ?, 3, 'synced', ?, ?, ?)`,
    [
      id,
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z',
      values.first_name,
      values.last_name,
      values.university ?? null,
    ],
  );
}

describe('compte et données du téléphone', () => {
  it('relie les données sans propriétaire au compte, refuse de mélanger deux comptes', async () => {
    const db = await createTestDb();
    await createSubject(db, { name: 'Maths', colorId: 'blue' });
    expect(await claimLocalData(db, 'user-a')).toBe('ok');
    expect(await getAccountOwner(db)).toBe('user-a');
    expect(await claimLocalData(db, 'user-a')).toBe('ok');
    expect(await claimLocalData(db, 'user-b')).toBe('otherAccount');
    db.close();
  });

  it('efface les données d’un autre compte avant de relier le téléphone au nouveau', async () => {
    const db = await createTestDb();
    await setOnboardingDone(db);
    await createSubject(db, { name: 'Maths', colorId: 'blue' });
    await claimLocalData(db, 'user-a');
    await replaceLocalDataWithAccount(db, 'user-b');
    expect(await getAccountOwner(db)).toBe('user-b');
    expect(await isOnboardingDone(db)).toBe(true);
    const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM subjects', []);
    expect(n?.n).toBe(0);
    db.close();
  });

  it('pré-remplit le profil vide avec le nom de l’inscription', async () => {
    const db = await createTestDb();
    await fillProfileFromSignUp(db, { firstName: 'Yvan', lastName: 'Kamga' });
    expect(await getProfile(db)).toMatchObject({ firstName: 'Yvan', lastName: 'Kamga' });
    await fillProfileFromSignUp(db, { firstName: 'Autre', lastName: 'Nom' });
    expect((await getProfile(db))?.firstName).toBe('Yvan');
    db.close();
  });

  it('profil dupliqué (#5) : la ligne du serveur gagne, complétée par les champs locaux, le doublon disparaît', async () => {
    const db = await createTestDb();
    // Profil créé hors ligne sur ce téléphone…
    const localId = await saveProfile(db, {
      firstName: 'Yvan',
      lastName: 'Kamga',
      university: 'Université de Yaoundé I',
      field: 'Informatique',
      level: null,
      academicYear: null,
    });
    // … puis connexion à un compte qui a déjà un profil : le pull ramène la ligne du serveur.
    await receiveServerProfile(db, 'server-profile', { first_name: 'Y.', last_name: '' });
    // Avant même la fusion, l'écran montre la ligne synchronisée, pas la plus ancienne.
    expect((await getProfile(db))?.id).toBe('server-profile');

    expect(await mergeDuplicateProfiles(db)).toBe(1);
    expect(await mergeDuplicateProfiles(db)).toBe(0);
    const merged = await getProfile(db);
    expect(merged).toMatchObject({
      id: 'server-profile',
      firstName: 'Y.', // non vide côté serveur : gardé
      lastName: 'Kamga', // vide côté serveur : repris du téléphone
      university: 'Université de Yaoundé I',
      field: 'Informatique',
    });
    const rows = await db.getAllAsync<{
      id: string;
      deleted_at: string | null;
      sync_status: string;
    }>('SELECT id, deleted_at, sync_status FROM profiles ORDER BY id', []);
    expect(rows.find((r) => r.id === localId)).toMatchObject({ sync_status: 'pending_delete' });
    expect(rows.find((r) => r.id === localId)?.deleted_at).not.toBeNull();
    expect(rows.find((r) => r.id === 'server-profile')).toMatchObject({
      deleted_at: null,
      sync_status: 'pending_update',
    });
    db.close();
  });

  it('supprimer le compte vide toujours le téléphone, même si la déconnexion locale échoue', async () => {
    const db = await createTestDb();
    await createSubject(db, { name: 'Maths', colorId: 'blue' });
    await claimLocalData(db, 'user-a');
    mockRemote.deleteRemoteAccount.mockResolvedValue(undefined);
    mockRemote.signOut.mockRejectedValue(new Error('storage unavailable'));
    await deleteAccountEverywhere(db);
    expect(mockRemote.deleteRemoteAccount).toHaveBeenCalledTimes(1);
    expect(await getAccountOwner(db)).toBeNull();
    const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM subjects', []);
    expect(n?.n).toBe(0);

    // Serveur injoignable : rien n'est touché sur le téléphone.
    await createSubject(db, { name: 'Physique', colorId: 'blue' });
    mockRemote.deleteRemoteAccount.mockRejectedValue(new AccountError('auth.error.deleteFailed'));
    await expect(deleteAccountEverywhere(db)).rejects.toBeInstanceOf(AccountError);
    const kept = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM subjects', []);
    expect(kept?.n).toBe(1);
    db.close();
  });
  it('suppression du compte : serveur en échec (401, réseau) → rien n’est effacé ni détaché', async () => {
    const db = await createTestDb();
    await createSubject(db, { name: 'Maths', colorId: 'blue' });
    await claimLocalData(db, 'user-a');
    mockRemote.signOut.mockReset();
    for (const key of ['auth.sessionExpired', 'errors.network']) {
      mockRemote.deleteRemoteAccount.mockRejectedValueOnce(new AccountError(key));
      await expect(deleteAccountEverywhere(db)).rejects.toMatchObject({ message: key });
    }
    expect(mockRemote.signOut).not.toHaveBeenCalled();
    expect(await getAccountOwner(db)).toBe('user-a');
    const n = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM subjects', []);
    expect(n?.n).toBe(1);
    db.close();
  });

  it('suppression du compte : le vidage du téléphone échoue → erreur claire, téléphone détaché', async () => {
    const db = await createTestDb();
    await claimLocalData(db, 'user-a');
    mockRemote.deleteRemoteAccount.mockResolvedValue(undefined);
    mockRemote.signOut.mockResolvedValue(undefined);
    const wipe = jest.spyOn(wipeModule, 'wipeAllData').mockRejectedValueOnce(new Error('disk'));
    await expect(deleteAccountEverywhere(db)).rejects.toMatchObject({
      message: 'auth.error.localWipeFailed',
    });
    expect(mockRemote.signOut).toHaveBeenCalled();
    expect(await getAccountOwner(db)).toBeNull();
    wipe.mockRestore();
    db.close();
  });
});
