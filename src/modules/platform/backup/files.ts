import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getLastBackupAt, setLastBackupAt } from '@/modules/identity';
import { nowIso, type Db } from '@/shared/db';
import { AppError } from '@/shared/errors';
import { i18n } from '@/shared/i18n';
import { logger } from '@/shared/logger';

import { createSnapshot, parseSnapshot, restoreSnapshot, type BackupSnapshot } from './snapshot';

/** Dossier privé de l'app où vont les sauvegardes automatiques. */
export const BACKUP_DIR = 'backups';
/** Nombre de sauvegardes automatiques gardées (les plus anciennes sont supprimées). */
export const BACKUPS_KEPT = 7;
/** Une sauvegarde automatique par jour au plus. */
export const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type BackupFile = {
  name: string;
  uri: string;
  size: number | null;
  /** Date de création, lue dans le nom du fichier (ISO). */
  createdAt: string;
};

function backupDirectory(): Directory {
  const dir = new Directory(Paths.document, BACKUP_DIR);
  dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** `mysky-2026-09-24T10-30-00.json` : trié par nom = trié par date. */
function fileNameFor(iso: string): string {
  return `mysky-${iso.slice(0, 19).replace(/:/g, '-')}.json`;
}

function createdAtOf(name: string): string {
  const m = /^mysky-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})\.json$/.exec(name);
  return m ? `${m[1]}T${m[2]}:${m[3]}:${m[4]}` : '';
}

/** Sauvegardes présentes, la plus récente d'abord. */
export function listBackups(): BackupFile[] {
  try {
    return backupDirectory()
      .list()
      .filter((entry): entry is File => entry instanceof File && createdAtOf(entry.name) !== '')
      .map((f) => ({ name: f.name, uri: f.uri, size: f.size, createdAt: createdAtOf(f.name) }))
      .sort((a, b) => (a.name < b.name ? 1 : -1));
  } catch (e) {
    logger.warn('Sauvegardes illisibles', { where: 'listBackups' });
    logger.error(e, { where: 'listBackups' });
    return [];
  }
}

/** Écrit une sauvegarde complète maintenant, puis ne garde que les plus récentes. */
export async function writeBackup(db: Db, now = new Date()): Promise<BackupFile> {
  const snapshot = await createSnapshot(db);
  const iso = now.toISOString();
  let file: File;
  try {
    file = new File(backupDirectory(), fileNameFor(iso));
    file.write(JSON.stringify(snapshot));
  } catch (e) {
    logger.error(e, { where: 'writeBackup' });
    throw new AppError('saveFailed', 'backup write failed', { cause: e });
  }
  await setLastBackupAt(db, nowIso());
  for (const old of listBackups().slice(BACKUPS_KEPT)) {
    try {
      new File(old.uri).delete();
    } catch {
      logger.warn('Ancienne sauvegarde non supprimée', { name: old.name });
    }
  }
  return { name: file.name, uri: file.uri, size: file.size, createdAt: createdAtOf(file.name) };
}

/** Sauvegarde automatique si la dernière date de plus de 24 h (ou n'existe pas). */
export async function autoBackupIfDue(db: Db, now = new Date()): Promise<boolean> {
  const last = await getLastBackupAt(db);
  if (last && now.getTime() - new Date(last).getTime() < AUTO_BACKUP_INTERVAL_MS) return false;
  await writeBackup(db, now);
  return true;
}

/** Ouvre la feuille de partage du téléphone (Fichiers, AirDrop, mail…) avec ce fichier. */
export async function shareBackup(uri: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: i18n.t('backup.shareTitle'),
  });
  return true;
}

/** Lit et vérifie une sauvegarde (fichier interne ou choisi par l'utilisateur), sans rien modifier. */
export async function readBackup(db: Db, uri: string): Promise<BackupSnapshot> {
  let text: string;
  try {
    text = await new File(uri).text();
  } catch (e) {
    logger.error(e, { where: 'readBackup' });
    throw new AppError('validation', 'backupUnreadable', { cause: e });
  }
  return parseSnapshot(db, text);
}

/** Remplace les données actuelles par cette sauvegarde (à confirmer avant par l'utilisateur). */
export async function restoreBackup(db: Db, snapshot: BackupSnapshot): Promise<void> {
  try {
    await restoreSnapshot(db, snapshot);
  } catch (e) {
    logger.error(e, { where: 'restoreBackup' });
    throw new AppError('saveFailed', 'restore failed', { cause: e });
  }
}

/** Laisse l'utilisateur choisir un fichier de sauvegarde (.json). null si annulé. */
export async function pickBackupFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
    type: ['application/json', 'public.json', '*/*'],
  });
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

/** Supprime toutes les sauvegardes locales. */
export function deleteAllBackups(): void {
  try {
    const dir = new Directory(Paths.document, BACKUP_DIR);
    if (dir.exists) dir.delete();
  } catch {
    logger.warn('Dossier des sauvegardes non supprimé');
  }
}
