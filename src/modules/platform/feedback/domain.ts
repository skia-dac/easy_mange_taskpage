import { z } from 'zod';

/**
 * « Donner mon avis » : règles pures (pas d'Expo ici).
 * Un retour reste sur le téléphone (table locale `feedback`, hors synchronisation des données
 * personnelles) jusqu'à son envoi au serveur (`mysky_submit_feedback`) ou par e-mail.
 */
export const FEEDBACK_KINDS = ['bug', 'idea', 'other'] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const FEEDBACK_AREAS = [
  'today',
  'calendar',
  'tasks',
  'notes',
  'habits',
  'revision',
  'money',
  'account',
  'reminders',
  'other',
] as const;
export type FeedbackArea = (typeof FEEDBACK_AREAS)[number];

export const FEEDBACK_STATUSES = ['pending', 'sent'] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const MESSAGE_MIN = 10;
export const MESSAGE_MAX = 2000;
export const CONTACT_MAX = 200;
/** Nombre de caractères du message montrés dans « Mes retours ». */
export const PREVIEW_LENGTH = 60;

/** Nom technique d'une erreur (ex. « TypeError ») : jamais son message, qui peut contenir des données. */
const ERROR_NAME = /^[A-Za-z][A-Za-z0-9_.]{0,59}$/;

export function safeErrorName(value: unknown): string | null {
  return typeof value === 'string' && ERROR_NAME.test(value) ? value : null;
}

export const feedbackInputSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS, { error: 'validation.required' }),
  area: z
    .enum(FEEDBACK_AREAS)
    .nullish()
    .transform((v) => v ?? 'other'),
  message: z
    .string({ error: 'validation.required' })
    .trim()
    .min(1, { error: 'validation.required' })
    .min(MESSAGE_MIN, { error: 'validation.feedbackTooShort' })
    .max(MESSAGE_MAX, { error: 'validation.tooLong' }),
  blocking: z
    .boolean()
    .nullish()
    .transform((v) => v === true),
  contactEmail: z
    .string()
    .nullish()
    .transform((v) => {
      const t = (v ?? '').trim().toLowerCase();
      return t === '' ? null : t;
    })
    .pipe(
      z
        .email({ error: 'validation.invalidEmail' })
        .max(CONTACT_MAX, { error: 'validation.tooLong' })
        .nullable(),
    ),
  /** Chemin RELATIF de la capture copiée dans le dossier de l'app (attachments/feedback/…). */
  screenshotPath: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null)),
  errorName: z
    .string()
    .nullish()
    .transform((v) => safeErrorName(v)),
});

/** Saisie du formulaire : le type peut manquer (aucune carte choisie), la validation le signale. */
export type FeedbackInput = Omit<z.input<typeof feedbackInputSchema>, 'kind'> & {
  kind?: FeedbackKind | null;
};
export type ParsedFeedbackInput = z.output<typeof feedbackInputSchema>;

/** Informations techniques jointes automatiquement (aucune donnée personnelle). */
export type FeedbackContext = { appVersion: string; os: string; locale: string };

export type Feedback = ParsedFeedbackInput &
  FeedbackContext & {
    id: string;
    area: FeedbackArea;
    status: FeedbackStatus;
    sentAt: string | null;
    createdAt: string;
    errorCode: string | null;
  };

/** Un bug peut être bloquant ; pour une idée ou autre chose, la case n'a pas de sens. */
export function normalizeFeedback(input: ParsedFeedbackInput): ParsedFeedbackInput {
  return { ...input, blocking: input.kind === 'bug' && input.blocking };
}

export function previewOf(message: string, max = PREVIEW_LENGTH): string {
  const oneLine = message.replace(/\s+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max).trimEnd()}…`;
}

/** Corps envoyé à `mysky_submit_feedback` (le serveur revalide tout et pose user_id lui-même). */
export function feedbackPayload(
  f: Feedback,
  deviceRef: string,
  remoteScreenshot: string | null,
): Record<string, string | boolean | null> {
  return {
    id: f.id,
    device_ref: deviceRef,
    kind: f.kind,
    area: f.area,
    message: f.message,
    blocking: f.blocking,
    contact_email: f.contactEmail,
    app_version: f.appVersion,
    os: f.os,
    locale: f.locale,
    error_name: f.errorName,
    screenshot_path: remoteScreenshot,
  };
}

/** Textes traduits pour l'e-mail de repli (fournis par l'appelant : le domaine ne dépend pas d'i18n). */
export type MailLabels = {
  subject: string;
  kind: string;
  area: string;
  blocking: string | null;
  contact: string | null;
  technical: string;
};

/** Lien `mailto:` avec le retour dans le corps (repli quand aucun serveur n'est configuré). */
export function buildMailto(to: string, f: Feedback, labels: MailLabels): string {
  const lines = [
    labels.kind,
    labels.area,
    ...(labels.blocking ? [labels.blocking] : []),
    '',
    f.message,
    '',
    ...(labels.contact ? [labels.contact] : []),
    labels.technical,
  ];
  const query = `subject=${encodeURIComponent(labels.subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  return `mailto:${to}?${query}`;
}
