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

/**
 * Ordre de préférence quand plusieurs profils coexistent (profil créé hors ligne, puis compte qui en
 * a déjà un) : la ligne déjà synchronisée la plus récente d'abord, sinon la plus ancienne.
 */
const PREFERRED_FIRST = `ORDER BY CASE WHEN sync_status = 'synced' THEN 0 ELSE 1 END, updated_at DESC, created_at`;

export async function getProfile(db: Db): Promise<Profile | null> {
  const row = await db.getFirstAsync<ProfileRow>(
    `SELECT * FROM profiles WHERE deleted_at IS NULL ${PREFERRED_FIRST} LIMIT 1`,
    [],
  );
  return row ? toProfile(row) : null;
}

const MERGEABLE = [
  'first_name',
  'last_name',
  'photo_path',
  'university',
  'field',
  'level',
  'academic_year',
] as const;

/**
 * Fusionne les profils en double (audit #5) : on garde la ligne préférée (celle du serveur), on y
 * copie les champs des autres lignes quand les siens sont vides, puis on supprime les autres.
 * Appelée après chaque synchronisation réussie : c'est le pull qui fait apparaître le doublon.
 * @returns le nombre de lignes fusionnées (0 = rien à faire)
 */
export async function mergeDuplicateProfiles(db: Db): Promise<number> {
  const rows = await db.getAllAsync<ProfileRow>(
    `SELECT * FROM profiles WHERE deleted_at IS NULL ${PREFERRED_FIRST}`,
    [],
  );
  if (rows.length < 2) return 0;
  const [kept, ...others] = rows as [ProfileRow, ...ProfileRow[]];
  await write(db, async (w) => {
    const patch: Record<string, string> = {};
    for (const other of others) {
      for (const column of MERGEABLE) {
        const mine = patch[column] ?? kept[column];
        const theirs = other[column];
        if (!mine && theirs) patch[column] = theirs;
      }
      await w.softDelete('profiles', other.id);
    }
    if (Object.keys(patch).length) await w.update('profiles', kept.id, patch);
  });
  return others.length;
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
