import { newId, notifyChange, nowIso, readAppSetting, writeAppSetting, type Db } from '@/shared/db';
import { enumOr, parseInput } from '@/shared/validation';

import {
  FEEDBACK_AREAS,
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
  feedbackInputSchema,
  normalizeFeedback,
  safeErrorName,
  type Feedback,
  type FeedbackContext,
  type FeedbackInput,
} from './domain';

/**
 * Table locale `feedback` : volontairement HORS de `SYNCED_TABLES` et de la file de synchronisation
 * (un retour ne passe pas par la synchronisation des données personnelles), et hors sauvegarde
 * locale (`LOCAL_ONLY_TABLES`). Elle est vidée par « Supprimer toutes mes données ».
 */
export const FEEDBACK_TABLE = 'feedback';

/** Réglage : identifiant aléatoire de ce téléphone pour la limite d'envoi (jamais un identifiant matériel). */
export const DEVICE_REF_KEY = 'device_ref';

type Row = {
  id: string;
  kind: string;
  area: string;
  message: string;
  blocking: number;
  contact_email: string | null;
  screenshot_path: string | null;
  error_name: string | null;
  app_version: string;
  os: string;
  locale: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  error_code: string | null;
};

const toFeedback = (r: Row): Feedback => ({
  id: r.id,
  kind: enumOr(FEEDBACK_KINDS, r.kind, 'other'),
  area: enumOr(FEEDBACK_AREAS, r.area, 'other'),
  message: r.message,
  blocking: r.blocking === 1,
  contactEmail: r.contact_email,
  screenshotPath: r.screenshot_path,
  errorName: safeErrorName(r.error_name),
  appVersion: r.app_version,
  os: r.os,
  locale: r.locale,
  status: enumOr(FEEDBACK_STATUSES, r.status, 'pending'),
  sentAt: r.sent_at,
  createdAt: r.created_at,
  errorCode: r.error_code,
});

/** Identifiant aléatoire de ce téléphone, créé une seule fois. */
export async function getDeviceRef(db: Db): Promise<string> {
  const saved = await readAppSetting(db, DEVICE_REF_KEY);
  if (typeof saved === 'string' && saved.length >= 8) return saved;
  const ref = newId();
  await writeAppSetting(db, DEVICE_REF_KEY, ref, true);
  return ref;
}

/** Enregistre le retour sur le téléphone (statut « en attente d'envoi »). Lève ValidationError. */
export async function createFeedback(
  db: Db,
  input: FeedbackInput,
  context: FeedbackContext,
): Promise<string> {
  const v = normalizeFeedback(parseInput(feedbackInputSchema, input));
  const id = newId();
  await db.runAsync(
    `INSERT INTO feedback (id, kind, area, message, blocking, contact_email, screenshot_path,
       error_name, app_version, os, locale, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      id,
      v.kind,
      v.area,
      v.message,
      v.blocking ? 1 : 0,
      v.contactEmail,
      v.screenshotPath,
      v.errorName,
      context.appVersion.slice(0, 40),
      context.os.slice(0, 60),
      context.locale.slice(0, 10),
      nowIso(),
    ],
  );
  notifyChange([FEEDBACK_TABLE]);
  return id;
}

/** Les retours, du plus récent au plus ancien. */
export async function listFeedback(db: Db): Promise<Feedback[]> {
  const rows = await db.getAllAsync<Row>(
    'SELECT * FROM feedback ORDER BY created_at DESC, id DESC',
    [],
  );
  return rows.map(toFeedback);
}

export async function getFeedback(db: Db, id: string): Promise<Feedback | null> {
  const row = await db.getFirstAsync<Row>('SELECT * FROM feedback WHERE id = ?', [id]);
  return row ? toFeedback(row) : null;
}

/** En attente d'envoi, du plus ancien au plus récent (ordre d'envoi). */
export async function listPendingFeedback(db: Db): Promise<Feedback[]> {
  const rows = await db.getAllAsync<Row>(
    "SELECT * FROM feedback WHERE status = 'pending' ORDER BY created_at, id",
    [],
  );
  return rows.map(toFeedback);
}

export async function feedbackCounts(db: Db): Promise<{ total: number; pending: number }> {
  const r = await db.getFirstAsync<{ total: number; pending: number | null }>(
    "SELECT COUNT(*) AS total, SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending FROM feedback",
    [],
  );
  return { total: r?.total ?? 0, pending: r?.pending ?? 0 };
}

/** Marque le retour comme envoyé ; la capture locale n'est plus utile (retirée par l'appelant). */
export async function markFeedbackSent(db: Db, id: string): Promise<void> {
  await db.runAsync(
    "UPDATE feedback SET status = 'sent', sent_at = ?, error_code = NULL, screenshot_path = NULL WHERE id = ?",
    [nowIso(), id],
  );
  notifyChange([FEEDBACK_TABLE]);
}

/** Envoi raté : le retour reste en attente avec un code d'erreur court (jamais un message technique). */
export async function markFeedbackFailed(db: Db, id: string, code: string): Promise<void> {
  await db.runAsync("UPDATE feedback SET error_code = ? WHERE id = ? AND status = 'pending'", [
    code.slice(0, 40),
    id,
  ]);
  notifyChange([FEEDBACK_TABLE]);
}

/**
 * Supprime la ligne d'un retour ENCORE EN ATTENTE. Un retour envoyé n'est pas supprimable d'ici :
 * il est déjà sur le serveur. Renvoie le chemin de la capture à effacer (voir `deleteFeedback`).
 */
export async function removePendingFeedbackRow(db: Db, id: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ screenshot_path: string | null }>(
    "SELECT screenshot_path FROM feedback WHERE id = ? AND status = 'pending'",
    [id],
  );
  if (!row) return null;
  await db.runAsync("DELETE FROM feedback WHERE id = ? AND status = 'pending'", [id]);
  notifyChange([FEEDBACK_TABLE]);
  return row.screenshot_path;
}
