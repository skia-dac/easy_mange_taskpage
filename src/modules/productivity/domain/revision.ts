import { z } from 'zod';

import { timeToMinutes, type IsoDate, type Time } from '@/shared/dates';
import { isoDate, optionalId, optionalText, time } from '@/shared/validation';

/** Une séance de révision prévue dans le calendrier (souvent proposée par le plan de révision). */
export const revisionStatuses = ['planned', 'done', 'skipped'] as const;
export type RevisionStatus = (typeof revisionStatuses)[number];

export const revisionBlockInputSchema = z
  .object({
    subjectId: optionalId,
    examId: optionalId,
    timetableId: optionalId,
    date: isoDate,
    startTime: time,
    endTime: time,
    title: optionalText(80),
  })
  .superRefine((b, ctx) => {
    if (timeToMinutes(b.endTime) <= timeToMinutes(b.startTime)) {
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'validation.endAfterStart' });
    }
  });

export type RevisionBlockInput = z.input<typeof revisionBlockInputSchema>;
export type RevisionBlock = z.output<typeof revisionBlockInputSchema> & {
  id: string;
  status: RevisionStatus;
  studySessionId: string | null;
};

export function blockMinutes(b: { startTime: Time; endTime: Time }): number {
  return timeToMinutes(b.endTime) - timeToMinutes(b.startTime);
}

export function isBlockPast(b: { date: IsoDate }, today: IsoDate): boolean {
  return b.date < today;
}
