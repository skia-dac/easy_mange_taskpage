import { z } from 'zod';

import { fieldLimits } from '@/shared/fieldLimits';
import { subjectColors } from '@/shared/theme';
import { optionalText, requiredText } from '@/shared/validation';

export const subjectInputSchema = z.object({
  name: requiredText(fieldLimits.name80.max),
  code: optionalText(fieldLimits.code.max),
  teacher: optionalText(fieldLimits.teacher.max),
  room: optionalText(fieldLimits.room.max),
  colorId: z
    .string()
    .refine((id) => subjectColors.some((c) => c.id === id), { error: 'validation.required' }),
  semester: optionalText(fieldLimits.semester.max),
  description: optionalText(fieldLimits.description500.max),
});

export type SubjectInput = z.input<typeof subjectInputSchema>;
export type SubjectValues = z.output<typeof subjectInputSchema>;
export type Subject = SubjectValues & { id: string; createdAt: string; updatedAt: string };

export function colorOf(subject: Pick<Subject, 'colorId'> | undefined) {
  return (
    subjectColors.find((c) => c.id === subject?.colorId) ?? subjectColors[subjectColors.length - 1]!
  );
}
