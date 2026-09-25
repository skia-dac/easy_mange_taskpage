import { z } from 'zod';

import { timeToMinutes } from '@/shared/dates';
import { spaceSchema, type SpaceId } from '@/shared/spaces';
import { isoDate, optionalText, optionalTime, requiredText } from '@/shared/validation';

export const personalEventInputSchema = z
  .object({
    title: requiredText(120),
    date: isoDate,
    startTime: optionalTime,
    endTime: optionalTime,
    description: optionalText(1000),
    /** Date et heure du rappel (ISO), null = aucun (§40). */
    reminderAt: z.iso
      .datetime({ offset: true })
      .nullish()
      .transform((v) => v ?? null),
    /** Espace ; absent à la modification = on garde celui enregistré. */
    space: spaceSchema.optional(),
  })
  .superRefine((e, ctx) => {
    if (e.endTime && !e.startTime) {
      ctx.addIssue({ code: 'custom', path: ['startTime'], message: 'validation.required' });
    }
    if (e.startTime && e.endTime && timeToMinutes(e.endTime) <= timeToMinutes(e.startTime)) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'validation.endAfterStart' });
    }
  });

export type PersonalEventInput = z.input<typeof personalEventInputSchema>;
export type PersonalEvent = z.output<typeof personalEventInputSchema> & {
  id: string;
  space: SpaceId;
};
