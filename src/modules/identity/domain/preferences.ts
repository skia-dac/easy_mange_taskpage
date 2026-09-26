import { z } from 'zod';

/** Minutes avant un cours (§72). 0 = aucun rappel. */
export const courseReminderOptions = [0, 10, 15, 30, 60] as const;
export type CourseReminderMinutes = (typeof courseReminderOptions)[number];

/** Réglages de notification (§80). Enregistrés sur le téléphone et synchronisés (phase 2). */
export const notificationPreferencesSchema = z.object({
  courses: z.boolean(),
  assignments: z.boolean(),
  tasks: z.boolean(),
  exams: z.boolean(),
  endOfCourse: z.boolean(),
  events: z.boolean().default(true),
  /** Rappels des habitudes (à l'heure choisie sur chaque habitude). */
  habits: z.boolean().default(true),
  /** Son de la notification (iPhone et Android). */
  sound: z.boolean().default(true),
  /** Vibration (Android : canal dédié ; iPhone : suit le réglage du téléphone). */
  vibrate: z.boolean().default(true),
  /** Mode focus : aucun rappel pendant un cours (sauf « fin de cours »). */
  focusDuringCourses: z.boolean().default(false),
  /** Mode focus : aucun rappel pendant une session de révision (sauf sa fin). */
  focusDuringStudy: z.boolean().default(true),
  /** Rappel avant chaque séance de révision prévue. */
  revisions: z.boolean().default(true),
  /** Argent : rappels des charges fixes et des tontines. */
  money: z.boolean().default(true),
  /** Bilan du soir : un rappel chaque jour pour préparer demain. */
  eveningReview: z.boolean().default(true),
  eveningReviewTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .default('20:30'),
  courseReminderMinutes: z.union([
    z.literal(0),
    z.literal(10),
    z.literal(15),
    z.literal(30),
    z.literal(60),
  ]),
});

export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

export const defaultNotificationPreferences: NotificationPreferences = {
  courses: true,
  assignments: true,
  tasks: true,
  exams: true,
  endOfCourse: true,
  events: true,
  habits: true,
  sound: true,
  vibrate: true,
  focusDuringCourses: false,
  focusDuringStudy: true,
  revisions: true,
  money: true,
  eveningReview: true,
  eveningReviewTime: '20:30',
  courseReminderMinutes: 15,
};

export const languagePreferenceSchema = z.enum(['auto', 'fr', 'en']);
export type LanguagePreference = z.infer<typeof languagePreferenceSchema>;

export const appearancePreferenceSchema = z.enum(['auto', 'light', 'dark']);
export type AppearancePreference = z.infer<typeof appearancePreferenceSchema>;

/** Premier jour de la semaine : 1 = lundi, 6 = samedi, 7 = dimanche (numérotation ISO). */
export const weekStartOptions = [1, 6, 7] as const;
export const weekStartSchema = z.union([z.literal(1), z.literal(6), z.literal(7)]);
export type WeekStart = z.infer<typeof weekStartSchema>;
export const defaultWeekStart: WeekStart = 1;

export const accentPreferenceSchema = z.enum(['blue', 'violet', 'teal', 'green', 'rose', 'orange']);
export const textScalePreferenceSchema = z.enum(['small', 'normal', 'large', 'xlarge']);

/** Sections de l'écran Aujourd'hui que l'étudiant peut ordonner ou masquer. */
export const todaySectionIds = [
  'glance',
  'day',
  'habits',
  'todo',
  'next',
  'money',
  'courses',
  'revision',
  'events',
  'exams',
] as const;
export type TodaySectionId = (typeof todaySectionIds)[number];

/**
 * Version de la mise en page : quand l'accueil change de modèle, les anciens réglages sont
 * remplacés une fois par le nouveau modèle (l'étudiant peut ensuite le personnaliser).
 */
export const TODAY_LAYOUT_VERSION = 2;

export const todayLayoutSchema = z.object({
  v: z.number().int().optional(),
  order: z.array(z.enum(todaySectionIds)),
  hidden: z.array(z.enum(todaySectionIds)).default([]),
});
export type TodayLayout = z.infer<typeof todayLayoutSchema>;

/** Accueil par défaut : tuiles, fil de la journée, habitudes, à faire. Le reste est masqué. */
export const defaultTodayHidden: readonly TodaySectionId[] = [
  'next',
  'money',
  'courses',
  'revision',
  'events',
  'exams',
];

/** Ordre complet : l'ordre enregistré, puis les sections ajoutées depuis (nouvelles versions). */
export function normalizeTodayLayout(layout: Partial<TodayLayout> | null | undefined): TodayLayout {
  const current = layout?.v === TODAY_LAYOUT_VERSION ? layout : null;
  const order = (current?.order ?? []).filter(
    (id, i, all) => todaySectionIds.includes(id) && all.indexOf(id) === i,
  );
  for (const id of todaySectionIds) if (!order.includes(id)) order.push(id);
  const hidden = current
    ? (current.hidden ?? []).filter((id) => todaySectionIds.includes(id))
    : [...defaultTodayHidden];
  return { v: TODAY_LAYOUT_VERSION, order, hidden };
}
