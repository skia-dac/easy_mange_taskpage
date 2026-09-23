import { z } from 'zod';

import type { IsoDate } from '@/shared/dates';
import { isoDate, requiredText } from '@/shared/validation';

export const offPeriodKinds = ['holiday', 'day_off'] as const;
export type OffPeriodKind = (typeof offPeriodKinds)[number];

/** Vacances (période) ou jour sans cours (§41, §43). */
export const offPeriodInputSchema = z
  .object({
    name: requiredText(60),
    kind: z.enum(offPeriodKinds),
    startDate: isoDate,
    endDate: isoDate,
    suspendCourses: z.boolean(),
  })
  .refine((p) => p.endDate >= p.startDate, {
    error: 'validation.untilAfterFrom',
    path: ['endDate'],
  });

export type OffPeriodInput = z.input<typeof offPeriodInputSchema>;
export type OffPeriod = z.output<typeof offPeriodInputSchema> & { id: string };

export function isDayOff(periods: readonly OffPeriod[], day: IsoDate): OffPeriod | undefined {
  return periods.find((p) => p.startDate <= day && day <= p.endDate);
}
