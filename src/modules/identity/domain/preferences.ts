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
  courseReminderMinutes: 15,
};

export const languagePreferenceSchema = z.enum(['auto', 'fr', 'en']);
export type LanguagePreference = z.infer<typeof languagePreferenceSchema>;

export const appearancePreferenceSchema = z.enum(['auto', 'light', 'dark']);
export type AppearancePreference = z.infer<typeof appearancePreferenceSchema>;
