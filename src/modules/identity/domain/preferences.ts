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
