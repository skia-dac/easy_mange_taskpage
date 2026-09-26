import { createSubject } from '@/modules/academic';
import {
  getAccountOwner,
  getProfile,
  isOnboardingDone,
  setOnboardingDone,
} from '@/modules/identity';
import { createTestDb } from '@/test/memoryDb';

import { claimLocalData, fillProfileFromSignUp, replaceLocalDataWithAccount } from './account';

jest.mock('@/modules/platform', () => ({
  ...jest.requireActual('@/modules/platform'),
  cancelAllReminders: async () => undefined,
  deleteAllAttachments: () => undefined,
  deleteAllBackups: () => undefined,
}));

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
});
