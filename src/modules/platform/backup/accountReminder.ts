import { readAppSetting, writeAppSetting, type Db } from '@/shared/db';

/**
 * Carte « Crée un compte pour ne jamais perdre tes données » (Aujourd'hui, sans compte).
 * Sans compte, les données ne sont que sur ce téléphone : la carte le rappelle doucement, une fois
 * qu'il y a vraiment quelque chose à perdre. Rien n'est envoyé, aucune notification.
 */

/** Nombre d'éléments à partir duquel la carte apparaît. */
export const ACCOUNT_REMINDER_MIN_ITEMS = 10;
/** « Plus tard » : la carte se tait pendant 14 jours. */
export const ACCOUNT_REMINDER_SNOOZE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export const ACCOUNT_REMINDER_SNOOZE_KEY = 'account_reminder_snoozed_at';

/**
 * Tables comptées comme « données de l'utilisateur » (pas les réglages ni la file d'envoi).
 * Toutes ont les SYNC_COLUMNS : on ne compte que les lignes vivantes (`deleted_at IS NULL`).
 */
export const COUNTED_TABLES = [
  'subjects',
  'course_series',
  'exams',
  'tasks',
  'assignments',
  'personal_events',
  'notes',
  'habits',
  'habit_logs',
  'mood_logs',
  'revision_blocks',
  'work_slots',
  'money_transactions',
  'money_recurring',
  'money_goals',
  'money_loans',
] as const;

/** Nombre d'éléments vivants de l'utilisateur sur ce téléphone (une seule requête). */
export async function countUserItems(db: Db): Promise<number> {
  // Noms de tables issus de la liste ci-dessus (jamais d'une saisie), donc sûrs à insérer.
  const sum = COUNTED_TABLES.map(
    (t) => `(SELECT COUNT(*) FROM ${t} WHERE deleted_at IS NULL)`,
  ).join(' + ');
  const row = await db.getFirstAsync<{ n: number }>(`SELECT ${sum} AS n`, []);
  return row?.n ?? 0;
}

/** Moment (ISO) du dernier « Plus tard », ou null. */
export async function getAccountReminderSnoozedAt(db: Db): Promise<string | null> {
  const v = await readAppSetting(db, ACCOUNT_REMINDER_SNOOZE_KEY);
  return typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null;
}

export async function setAccountReminderSnoozedAt(db: Db, iso: string): Promise<void> {
  await writeAppSetting(db, ACCOUNT_REMINDER_SNOOZE_KEY, iso);
}

export type AccountReminderInput = {
  /** Comptes disponibles dans cette version (serveur configuré). */
  accountsEnabled: boolean;
  /** Session encore en cours de lecture : on ne montre rien tant qu'on ne sait pas. */
  authLoading: boolean;
  signedIn: boolean;
  itemCount: number;
  snoozedAt: string | null;
  now: Date;
};

/** « Plus tard » répondu il y a moins de 14 jours ? Une date future (horloge changée) ne bloque pas. */
export function isAccountReminderSnoozed(snoozedAt: string | null, now: Date): boolean {
  if (!snoozedAt) return false;
  const elapsed = now.getTime() - new Date(snoozedAt).getTime();
  return elapsed >= 0 && elapsed < ACCOUNT_REMINDER_SNOOZE_DAYS * DAY_MS;
}

/** La carte s'affiche-t-elle ? Jamais avec un compte, ni quand les comptes n'existent pas. */
export function shouldShowAccountReminder(input: AccountReminderInput): boolean {
  if (!input.accountsEnabled || input.authLoading || input.signedIn) return false;
  if (input.itemCount < ACCOUNT_REMINDER_MIN_ITEMS) return false;
  return !isAccountReminderSnoozed(input.snoozedAt, input.now);
}
