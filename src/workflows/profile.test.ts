import { fullName, getProfile, initials, saveProfile, setProfilePhoto } from '@/modules/identity';
import type { Db } from '@/shared/db';
import { createTestDb } from '@/test/memoryDb';

let db: Db & { close(): void };
beforeEach(async () => {
  db = await createTestDb();
});
afterEach(() => db.close());

it('profil : une seule ligne, créée puis mise à jour (§6)', async () => {
  expect(await getProfile(db)).toBeNull();
  const id = await saveProfile(db, { firstName: 'Awa', lastName: 'Diallo', university: 'UCAD' });
  expect(await saveProfile(db, { firstName: 'Awa', lastName: 'Diallo', field: 'Gestion' })).toBe(
    id,
  );
  const p = await getProfile(db);
  expect(p?.field).toBe('Gestion');
  expect(fullName(p)).toBe('Awa Diallo');
  expect(initials(p)).toBe('AD');
  await setProfilePhoto(db, 'attachments/profile/x.jpg');
  expect((await getProfile(db))?.photoPath).toBe('attachments/profile/x.jpg');
});
