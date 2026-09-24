import { z } from 'zod';

import { isoWeekday, timeToMinutes, type IsoDate, type Time } from '@/shared/dates';
import { isoDate, optionalId, optionalText, requiredId, time } from '@/shared/validation';

export const courseTypes = [
  'lecture',
  'tutorial',
  'lab',
  'seminar',
  'workshop',
  'online',
  'other',
] as const;
export type CourseType = (typeof courseTypes)[number];

export const recurrences = ['none', 'weekly'] as const;
export type Recurrence = (typeof recurrences)[number];

/**
 * Saisie d'un cours.
 * - Cours unique : `startDate` = le jour du cours.
 * - Cours hebdomadaire : chaque `weekday`, de `startDate` à `endDate` (règle 2 : période obligatoire).
 */
export const courseInputSchema = z
  .object({
    subjectId: requiredId('validation.subjectRequired'),
    timetableId: optionalId,
    title: optionalText(80),
    teacher: optionalText(80),
    room: optionalText(40),
    courseType: z.enum(courseTypes),
    recurrence: z.enum(recurrences),
    weekday: z.number().int().min(1).max(7).nullish(),
    startDate: isoDate,
    endDate: isoDate.nullish(),
    startTime: time,
    endTime: time,
    description: optionalText(500),
    /** Minutes avant le cours ; null = réglage général ; 0 = aucun. */
    reminderMinutes: z.number().int().min(0).max(1440).nullish(),
  })
  .superRefine((c, ctx) => {
    if (timeToMinutes(c.endTime) <= timeToMinutes(c.startTime)) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'validation.endAfterStart' });
    }
    if (c.recurrence === 'weekly') {
      if (!c.endDate) {
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'validation.required' });
      } else if (c.endDate < c.startDate) {
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'validation.untilAfterFrom' });
      }
    }
  })
  .transform((c) => {
    const weekly = c.recurrence === 'weekly';
    return {
      subjectId: c.subjectId,
      timetableId: c.timetableId,
      title: c.title,
      teacher: c.teacher,
      room: c.room,
      courseType: c.courseType,
      recurrence: c.recurrence,
      weekday: weekly ? (c.weekday ?? isoWeekday(c.startDate)) : isoWeekday(c.startDate),
      validFrom: c.startDate,
      validUntil: weekly ? (c.endDate as IsoDate) : c.startDate,
      startTime: c.startTime,
      endTime: c.endTime,
      description: c.description,
      reminderMinutes: c.reminderMinutes ?? null,
    };
  });

export type CourseInput = z.input<typeof courseInputSchema>;
export type CourseSeriesValues = z.output<typeof courseInputSchema>;
export type CourseSeries = CourseSeriesValues & { id: string };

/** Une séance précise d'un cours, à une date donnée. */
export type Occurrence = {
  seriesId: string;
  subjectId: string;
  /** Jour où la séance a lieu (après un éventuel déplacement). */
  date: IsoDate;
  /** Jour prévu par la série : c'est la clé de l'exception (annuler, modifier…). */
  originalDate: IsoDate;
  startTime: Time;
  endTime: Time;
  title: string | null;
  teacher: string | null;
  room: string | null;
  courseType: CourseType;
  recurrence: Recurrence;
  /** normal : comme la série · modified : modifiée ce jour · cancelled : annulée (reste visible) */
  status: OccurrenceStatus;
  exceptionId: string | null;
  note: string | null;
};

export type OccurrenceStatus = 'normal' | 'modified' | 'cancelled';
