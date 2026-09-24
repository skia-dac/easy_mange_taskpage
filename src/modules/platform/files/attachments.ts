import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import type { AttachmentKind } from '@/modules/productivity';
import { newId } from '@/shared/db';
import { AppError } from '@/shared/errors';
import { logger } from '@/shared/logger';

/** Taille maximale d'une pièce jointe (Mo). */
export const MAX_ATTACHMENT_MB = 25;

export type PickedFile = {
  kind: AttachmentKind;
  name: string;
  mimeType: string | null;
  size: number | null;
  /** Chemin RELATIF au dossier documents de l'app (le chemin absolu change à chaque mise à jour iOS). */
  localPath: string;
};

const ROOT = 'attachments';

/** Chemin absolu utilisable par <Image> ou un lecteur de fichier. */
export function attachmentUri(localPath: string): string {
  return new File(Paths.document, localPath).uri;
}

export function attachmentExists(localPath: string): boolean {
  try {
    return new File(Paths.document, localPath).exists;
  } catch {
    return false;
  }
}

function extensionOf(name: string, mimeType: string | null): string {
  const fromName = /\.([a-z0-9]{1,6})$/i.exec(name)?.[1];
  if (fromName) return fromName.toLowerCase();
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType?.startsWith('image/')) return mimeType.slice(6);
  return 'bin';
}

/** Copie le fichier choisi dans le dossier de l'app (les fichiers de la galerie/du sélecteur sont temporaires). */
async function importFile(
  noteId: string,
  sourceUri: string,
  name: string,
  mimeType: string | null,
  size: number | null,
  kind: AttachmentKind,
): Promise<PickedFile> {
  if (size !== null && size > MAX_ATTACHMENT_MB * 1024 * 1024)
    throw new AppError('validation', 'attachmentTooBig');
  const dir = new Directory(Paths.document, ROOT, noteId);
  dir.create({ intermediates: true, idempotent: true });
  const fileName = `${newId()}.${extensionOf(name, mimeType)}`;
  const target = new File(dir, fileName);
  try {
    await new File(sourceUri).copy(target);
  } catch (e) {
    logger.error(e, { where: 'importFile' });
    throw new AppError('saveFailed', 'copy failed', { cause: e });
  }
  return {
    kind,
    name,
    mimeType,
    size: size ?? (target.exists ? target.size : null),
    localPath: `${ROOT}/${noteId}/${fileName}`,
  };
}

/** Choisit une image dans la galerie et la copie dans le dossier `folder` (ex. l'id d'une note, ou « profile »). null si annulé. */
export async function pickImage(folder: string): Promise<PickedFile | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsMultipleSelection: false,
  });
  const asset = result.canceled ? null : (result.assets[0] ?? null);
  if (!asset) return null;
  const name = asset.fileName ?? `image.${extensionOf('', asset.mimeType ?? 'image/jpeg')}`;
  return importFile(
    folder,
    asset.uri,
    name,
    asset.mimeType ?? null,
    asset.fileSize ?? null,
    'image',
  );
}

/** Choisit un fichier (PDF, document…). null si l'utilisateur annule. */
export async function pickDocument(noteId: string): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.canceled ? null : (result.assets[0] ?? null);
  if (!asset) return null;
  const kind: AttachmentKind = asset.mimeType?.startsWith('image/') ? 'image' : 'file';
  return importFile(
    noteId,
    asset.uri,
    asset.name,
    asset.mimeType ?? null,
    asset.size ?? null,
    kind,
  );
}

/** Supprime le fichier local (après suppression de la pièce jointe). Ne lève jamais d'erreur. */
export function deleteLocalFile(localPath: string): void {
  try {
    const f = new File(Paths.document, localPath);
    if (f.exists) f.delete();
  } catch {
    logger.warn('Fichier local non supprimé', { localPath });
  }
}

export function formatSize(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Supprime le dossier des pièces jointes (suppression de toutes les données). */
export function deleteAllAttachments(): void {
  try {
    const dir = new Directory(Paths.document, ROOT);
    if (dir.exists) dir.delete();
  } catch {
    logger.warn('Dossier des pièces jointes non supprimé');
  }
}
