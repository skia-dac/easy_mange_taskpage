import { z } from 'zod';

import { fieldLimits, isAcademicYear } from '@/shared/fieldLimits';
import { optionalText } from '@/shared/validation';

/** Profil de l'étudiant (§6). Une seule ligne, synchronisée en phase 2. */
export const profileInputSchema = z.object({
  firstName: optionalText(fieldLimits.firstName.max),
  lastName: optionalText(fieldLimits.lastName.max),
  university: optionalText(fieldLimits.university.max),
  field: optionalText(fieldLimits.studyField.max),
  level: optionalText(fieldLimits.level.max),
  academicYear: optionalText(20).refine((year) => year === null || isAcademicYear(year), {
    error: 'validation.invalidYear',
  }),
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
