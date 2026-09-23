import { z } from 'zod';

import { subjectColors } from '@/shared/theme';
import { optionalText, requiredText } from '@/shared/validation';

export const subjectInputSchema = z.object({
  name: requiredText(80),
  code: optionalText(20),
  teacher: optionalText(80),
  room: optionalText(40),
  colorId: z
    .string()
    .refine((id) => subjectColors.some((c) => c.id === id), { error: 'validation.required' }),
  semester: optionalText(20),
  description: optionalText(500),
});

export type SubjectInput = z.input<typeof subjectInputSchema>;
export type SubjectValues = z.output<typeof subjectInputSchema>;
export type Subject = SubjectValues & { id: string; createdAt: string; updatedAt: string };

export function colorOf(subject: Pick<Subject, 'colorId'> | undefined) {
  return (
    subjectColors.find((c) => c.id === subject?.colorId) ?? subjectColors[subjectColors.length - 1]!
  );
}
