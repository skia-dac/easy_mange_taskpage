import { z } from 'zod';

import { timeToMinutes, type IsoDate } from '@/shared/dates';
import { fieldLimits } from '@/shared/fieldLimits';
import { isoDate, optionalText, optionalTime, requiredId } from '@/shared/validation';

export const exceptionKinds = ['cancelled', 'modified'] as const;
export type ExceptionKind = (typeof exceptionKinds)[number];

/** Exception sur UNE séance d'une série (architecture §6.2) : annulée, ou modifiée ponctuellement. */
export type CourseException = {
  id: string;
  seriesId: string;
  date: IsoDate;
  kind: ExceptionKind;
  /** Séance déplacée à un autre jour (glisser-déposer dans la semaine). */
  newDate: IsoDate | null;
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
    /** Absent = on ne touche pas au jour ; null = la séance revient à son jour. */
    newDate: isoDate.nullable().optional(),
    newStartTime: optionalTime,
    newEndTime: optionalTime,
    newRoom: optionalText(fieldLimits.room.max),
    newTeacher: optionalText(fieldLimits.teacher.max),
    newTitle: optionalText(fieldLimits.title80.max),
    note: optionalText(fieldLimits.description500.max),
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
