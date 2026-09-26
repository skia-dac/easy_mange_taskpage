import type { SupabaseClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { File, Paths } from 'expo-file-system';
import { Linking, Platform } from 'react-native';

import type { Db } from '@/shared/db';
import { i18n } from '@/shared/i18n';
import { LEGAL } from '@/shared/legal';
import { logger } from '@/shared/logger';

import { deleteLocalFile } from '../files/attachments';
import { FEEDBACK_BUCKET } from '../sync/serverSchema';
import {
  createFeedback,
  getDeviceRef,
  getFeedback,
  listPendingFeedback,
  markFeedbackFailed,
  markFeedbackSent,
  removePendingFeedbackRow,
} from './data';
import {
  buildMailto,
  feedbackPayload,
  type Feedback,
  type FeedbackContext,
  type FeedbackInput,
} from './domain';

/** Dossier local des captures (sous `attachments/`, mais hors synchronisation des fichiers). */
export const FEEDBACK_FOLDER = 'feedback';

/** Informations techniques jointes à chaque retour : version, système, langue. Rien de personnel. */
export function feedbackContext(): FeedbackContext {
  const os = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS;
  return {
    appVersion: Constants.expoConfig?.version ?? '?',
    os: `${os} ${String(Platform.Version)}`,
    locale: (i18n.language || 'fr').slice(0, 10),
  };
}

type LocalFile = { bytes: Uint8Array; type: string };
export type FeedbackDeps = {
  /** Lit la capture locale (remplacé dans les tests). */
  readFile?: (localPath: string) => Promise<LocalFile | null>;
};

async function readLocalFile(localPath: string): Promise<LocalFile | null> {
  const file = new File(Paths.document, localPath);
  if (!file.exists) return null;
  return { bytes: await file.bytes(), type: file.type };
}

const IMAGE_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
};

function extensionOf(path: string): string {
  const ext = /\.([a-z0-9]{1,5})$/i.exec(path)?.[1]?.toLowerCase();
  return ext && ext in IMAGE_TYPES ? ext : 'jpg';
}

type ServerError = { message?: string; code?: string; statusCode?: string | number } | null;

/** Codes courts gardés sur le téléphone (jamais un message technique affiché). */
export type FeedbackErrorCode = 'network' | 'rate_limited' | 'rejected' | 'unknown';

class FeedbackSendError extends Error {
  constructor(readonly code: FeedbackErrorCode) {
    super(code);
    this.name = 'FeedbackSendError';
  }
}

function classify(error: ServerError): FeedbackErrorCode {
  const m = (error?.message ?? '').toLowerCase();
  if (m.includes('network') || m.includes('fetch') || m.includes('timeout')) return 'network';
  if (error?.code === 'MSK29' || m.includes('rate_limited')) return 'rate_limited';
  if (error?.code === '22023' || error?.code === '23514') return 'rejected';
  return 'unknown';
}

/** Envoie la capture dans le bucket privé, sous `<uid>/<id>.<ext>`. null = pas de capture envoyée. */
async function uploadScreenshot(
  client: SupabaseClient,
  userId: string,
  f: Feedback,
  readFile: NonNullable<FeedbackDeps['readFile']>,
): Promise<string | null> {
  if (!f.screenshotPath) return null;
  const local = await readFile(f.screenshotPath).catch(() => null);
  if (!local) return null;
  const ext = extensionOf(f.screenshotPath);
  const remotePath = `${userId}/${f.id}.${ext}`;
  const type = local.type.startsWith('image/') ? local.type : (IMAGE_TYPES[ext] ?? 'image/jpeg');
  const { error } = await client.storage
    .from(FEEDBACK_BUCKET)
    .upload(remotePath, local.bytes, { contentType: type, upsert: false });
  if (!error) return remotePath;
  const e = error as ServerError;
  // Déjà envoyée lors d'un essai précédent (réponse perdue) : c'est bon.
  if (String(e?.statusCode ?? '') === '409' || /exists/i.test(e?.message ?? '')) return remotePath;
  if (classify(e) === 'network') throw new FeedbackSendError('network');
  // Capture refusée (taille, type) : le retour part quand même, sans elle.
  logger.warn('Capture du retour non envoyée');
  return null;
}

async function currentUserId(client: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await client.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

export type FeedbackSendReport = { sent: number; pending: number };

async function sendAll(
  db: Db,
  client: SupabaseClient | null,
  deps: FeedbackDeps,
): Promise<FeedbackSendReport> {
  const pending = await listPendingFeedback(db);
  if (!client || pending.length === 0) return { sent: 0, pending: pending.length };
  const deviceRef = await getDeviceRef(db);
  const userId = await currentUserId(client);
  const readFile = deps.readFile ?? readLocalFile;
  let sent = 0;
  for (const f of pending) {
    try {
      const remoteShot = userId ? await uploadScreenshot(client, userId, f, readFile) : null;
      const { error } = await client.rpc('mysky_submit_feedback', {
        p: feedbackPayload(f, deviceRef, remoteShot),
      });
      if (error) throw new FeedbackSendError(classify(error as ServerError));
      await markFeedbackSent(db, f.id);
      if (f.screenshotPath) deleteLocalFile(f.screenshotPath);
      sent += 1;
    } catch (e) {
      const code = e instanceof FeedbackSendError ? e.code : classify(e as ServerError);
      await markFeedbackFailed(db, f.id, code);
      // Hors ligne ou limite atteinte : inutile d'essayer les suivants maintenant.
      if (code === 'network' || code === 'rate_limited') break;
      logger.error(e, { where: 'sendFeedback', code });
    }
  }
  return { sent, pending: pending.length - sent };
}

let queue: Promise<unknown> = Promise.resolve();

/**
 * Envoie les retours en attente au serveur (`mysky_submit_feedback`), un par un, dans l'ordre.
 * Sans serveur configuré (`client` null), ne fait rien. Un envoi à la fois : un appel pendant
 * un autre attend la fin du premier (le retour tout juste créé est donc bien pris).
 */
export function sendPendingFeedback(
  db: Db,
  client: SupabaseClient | null,
  deps: FeedbackDeps = {},
): Promise<FeedbackSendReport> {
  const run = queue.then(() => sendAll(db, client, deps));
  queue = run.catch(() => undefined);
  return run;
}

/** Textes de l'e-mail, dans la langue de l'app. */
function mailFor(f: Feedback): string {
  const kind = i18n.t(`feedback.kind.${f.kind}.title`);
  const area = i18n.t(`feedback.area.${f.area}`);
  return buildMailto(LEGAL.contactEmail, f, {
    subject: i18n.t('feedback.mail.subject', { kind, area }),
    kind: i18n.t('feedback.mail.kind', { value: kind }),
    area: i18n.t('feedback.mail.area', { value: area }),
    blocking: f.blocking ? i18n.t('feedback.mail.blocking') : null,
    contact: f.contactEmail ? i18n.t('feedback.mail.contact', { value: f.contactEmail }) : null,
    technical: i18n.t('feedback.mail.technical', {
      version: f.appVersion,
      os: f.os,
      locale: f.locale,
      error: f.errorName ?? '-',
    }),
  });
}

/**
 * Repli sans serveur : ouvre l'application de messagerie avec le retour pré-rempli.
 * Le retour est marqué envoyé si la messagerie s'ouvre ; sinon il reste en attente.
 */
export async function sendFeedbackByEmail(db: Db, id: string): Promise<boolean> {
  const f = await getFeedback(db, id);
  if (!f) return false;
  try {
    await Linking.openURL(mailFor(f));
  } catch (e) {
    logger.warn('Messagerie indisponible pour le retour');
    await markFeedbackFailed(db, id, e instanceof Error ? 'no_mail' : 'unknown');
    return false;
  }
  await markFeedbackSent(db, id);
  if (f.screenshotPath) deleteLocalFile(f.screenshotPath);
  return true;
}

export type SubmitOutcome = 'sent' | 'queued' | 'mailed' | 'mailFailed';

/**
 * Enregistre le retour sur le téléphone puis l'envoie tout de suite : au serveur s'il est
 * configuré (sinon il reste en file et repart plus tard), par e-mail sinon.
 */
export async function submitFeedback(
  db: Db,
  input: FeedbackInput,
  client: SupabaseClient | null,
  deps: FeedbackDeps = {},
): Promise<{ id: string; outcome: SubmitOutcome }> {
  const id = await createFeedback(db, input, feedbackContext());
  if (!client)
    return { id, outcome: (await sendFeedbackByEmail(db, id)) ? 'mailed' : 'mailFailed' };
  await sendPendingFeedback(db, client, deps).catch((e: unknown) =>
    logger.error(e, { where: 'submitFeedback' }),
  );
  const saved = await getFeedback(db, id);
  return { id, outcome: saved?.status === 'sent' ? 'sent' : 'queued' };
}

/** « Renvoyer maintenant » : au serveur, ou (sans serveur) le plus ancien par e-mail. */
export async function retryFeedback(
  db: Db,
  client: SupabaseClient | null,
): Promise<FeedbackSendReport> {
  if (client) return sendPendingFeedback(db, client);
  const pending = await listPendingFeedback(db);
  const first = pending[0];
  if (!first) return { sent: 0, pending: 0 };
  const ok = await sendFeedbackByEmail(db, first.id);
  return { sent: ok ? 1 : 0, pending: pending.length - (ok ? 1 : 0) };
}

/** Supprime un retour en attente et sa capture (à appeler après confirmation). */
export async function deleteFeedback(db: Db, id: string): Promise<void> {
  const shot = await removePendingFeedbackRow(db, id);
  if (shot) deleteLocalFile(shot);
}
