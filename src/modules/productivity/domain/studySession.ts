import { z } from 'zod';

import { toIsoDate, type IsoDate } from '@/shared/dates';
import { optionalId } from '@/shared/validation';

/** Durées proposées (minutes de travail / de pause), façon Pomodoro. */
export const studyPresets = [
  { work: 25, rest: 5 },
  { work: 45, rest: 10 },
  { work: 50, rest: 10 },
  { work: 90, rest: 15 },
] as const;

export const studyKinds = ['focus', 'break'] as const;
export type StudyKind = (typeof studyKinds)[number];

export const studySessionInputSchema = z.object({
  subjectId: optionalId,
  startedAt: z.iso.datetime({ offset: true }),
  plannedMinutes: z.number().int().min(1).max(240),
  kind: z.enum(studyKinds).default('focus'),
});

export type StudySessionInput = z.input<typeof studySessionInputSchema>;
export type StudySession = z.output<typeof studySessionInputSchema> & {
  id: string;
  endedAt: string | null;
};

/** Fin prévue de la session (début + durée choisie). */
export function plannedEnd(s: Pick<StudySession, 'startedAt' | 'plannedMinutes'>): Date {
  return new Date(new Date(s.startedAt).getTime() + s.plannedMinutes * 60_000);
}

/** Secondes restantes, jamais négatives. */
export function remainingSeconds(s: StudySession, now: Date): number {
  return Math.max(0, Math.round((plannedEnd(s).getTime() - now.getTime()) / 1000));
}

/** Minutes réellement passées (session terminée : jusqu'à sa fin ; en cours : jusqu'à maintenant). */
export function elapsedMinutes(s: StudySession, now: Date): number {
  const end = s.endedAt ? new Date(s.endedAt) : now;
  return Math.max(0, (end.getTime() - new Date(s.startedAt).getTime()) / 60_000);
}

export function isActive(s: StudySession, now: Date): boolean {
  return s.endedAt === null && plannedEnd(s).getTime() > now.getTime();
}

export type StudyTotals = {
  totalMinutes: number;
  bySubject: { subjectId: string | null; minutes: number }[];
  /** Minutes par jour (clé : date ISO), pour un graphique. */
  byDay: Map<IsoDate, number>;
};

/** Temps de travail (pas les pauses) entre deux dates incluses, par matière et par jour. */
export function studyTotals(
  sessions: readonly StudySession[],
  from: IsoDate,
  to: IsoDate,
  now: Date,
): StudyTotals {
  const bySubject = new Map<string | null, number>();
  const byDay = new Map<IsoDate, number>();
  let totalMinutes = 0;
  for (const s of sessions) {
    if (s.kind !== 'focus') continue;
    const day = toIsoDate(new Date(s.startedAt));
    if (day < from || day > to) continue;
    const minutes = elapsedMinutes(s, now);
    totalMinutes += minutes;
    bySubject.set(s.subjectId, (bySubject.get(s.subjectId) ?? 0) + minutes);
    byDay.set(day, (byDay.get(day) ?? 0) + minutes);
  }
  return {
    totalMinutes,
    bySubject: [...bySubject.entries()]
      .map(([subjectId, minutes]) => ({ subjectId, minutes }))
      .sort((a, b) => b.minutes - a.minutes),
    byDay,
  };
}
