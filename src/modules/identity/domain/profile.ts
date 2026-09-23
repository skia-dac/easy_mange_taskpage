import { z } from 'zod';

import { optionalText } from '@/shared/validation';

/** Profil de l'étudiant (§6). Une seule ligne, synchronisée en phase 2. */
export const profileInputSchema = z.object({
  firstName: optionalText(60),
  lastName: optionalText(60),
  university: optionalText(120),
  field: optionalText(120),
  level: optionalText(60),
  academicYear: optionalText(20),
});

export type ProfileInput = z.input<typeof profileInputSchema>;
export type Profile = {
  id: string;
  firstName: string;
  lastName: string;
  photoPath: string | null;
  university: string | null;
  field: string | null;
  level: string | null;
  academicYear: string | null;
};

export function fullName(p: Pick<Profile, 'firstName' | 'lastName'> | null | undefined): string {
  return [p?.firstName, p?.lastName].filter(Boolean).join(' ').trim();
}

export function initials(p: Pick<Profile, 'firstName' | 'lastName'> | null | undefined): string {
  return `${p?.firstName?.[0] ?? ''}${p?.lastName?.[0] ?? ''}`.toUpperCase();
}
