import { z } from 'zod';

import { timeToMinutes, type IsoDate } from '@/shared/dates';
import { isoDate, optionalText, optionalTime, requiredId } from '@/shared/validation';

export const exceptionKinds = ['cancelled', 'modified'] as const;
export type ExceptionKind = (typeof exceptionKinds)[number];

/** Exception sur UNE séance d'une série (architecture §6.2) : annulée, ou modifiée ponctuellement. */
export type CourseException = {
  id: string;
  seriesId: string;
  date: IsoDate;
  kind: ExceptionKind;
  newStartTime: string | null;
  newEndTime: string | null;
  newRoom: string | null;
  newTeacher: string | null;
  newTitle: string | null;
  note: string | null;
};

/** Saisie « modifier uniquement ce cours ». Un champ vide = on garde la valeur de la série. */
export const occurrenceOverrideSchema = z
  .object({
    seriesId: requiredId(),
    date: isoDate,
    newStartTime: optionalTime,
    newEndTime: optionalTime,
    newRoom: optionalText(40),
    newTeacher: optionalText(80),
    newTitle: optionalText(80),
    note: optionalText(500),
  })
  .superRefine((o, ctx) => {
    if (
      o.newStartTime &&
      o.newEndTime &&
      timeToMinutes(o.newEndTime) <= timeToMinutes(o.newStartTime)
    ) {
      ctx.addIssue({ code: 'custom', path: ['newEndTime'], message: 'validation.endAfterStart' });
    }
  });

export type OccurrenceOverrideInput = z.input<typeof occurrenceOverrideSchema>;
