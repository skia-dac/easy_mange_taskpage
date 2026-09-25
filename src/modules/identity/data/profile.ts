import { write, type Db } from '@/shared/db';
import { parseInput } from '@/shared/validation';

import { profileInputSchema, type Profile, type ProfileInput } from '../domain/profile';

type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  photo_path: string | null;
  university: string | null;
  field: string | null;
  level: string | null;
  academic_year: string | null;
};

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  firstName: r.first_name,
  lastName: r.last_name,
  photoPath: r.photo_path,
  university: r.university,
  field: r.field,
  level: r.level,
  academicYear: r.academic_year,
});

export async function getProfile(db: Db): Promise<Profile | null> {
  const row = await db.getFirstAsync<ProfileRow>(
    'SELECT * FROM profiles WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1',
    [],
  );
  return row ? toProfile(row) : null;
}

/** Crée ou met à jour l'unique profil. */
export async function saveProfile(db: Db, input: ProfileInput): Promise<string> {
  const v = parseInput(profileInputSchema, input);
  const values = {
    first_name: v.firstName ?? '',
    last_name: v.lastName ?? '',
    university: v.university,
    field: v.field,
    level: v.level,
    academic_year: v.academicYear,
  };
  const current = await getProfile(db);
  return write(db, async (w) => {
    if (current) {
      await w.update('profiles', current.id, values);
      return current.id;
    }
    return w.insert('profiles', values);
  });
}

export async function setProfilePhoto(db: Db, photoPath: string | null): Promise<void> {
  const current = await getProfile(db);
  await write(db, async (w) => {
    if (current) await w.update('profiles', current.id, { photo_path: photoPath });
    else await w.insert('profiles', { first_name: '', last_name: '', photo_path: photoPath });
  });
}
