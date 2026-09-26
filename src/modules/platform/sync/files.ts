import type { SupabaseClient } from '@supabase/supabase-js';
import { Directory, File, Paths } from 'expo-file-system';

import { nowIso, type Db } from '@/shared/db';
import { logger } from '@/shared/logger';

import { FILES_BUCKET } from './serverSchema';

/** Opérations sur les fichiers, séparées pour pouvoir être remplacées dans les tests. */
export type FileStore = {
  existsLocally(path: string): boolean;
  upload(remotePath: string, localPath: string): Promise<void>;
  download(remotePath: string, localPath: string): Promise<boolean>;
  remove(remotePath: string): Promise<void>;
};

export function supabaseFileStore(client: SupabaseClient): FileStore {
  const bucket = () => client.storage.from(FILES_BUCKET);
  return {
    existsLocally: (path) => {
      try {
        return new File(Paths.document, path).exists;
      } catch {
        return false;
      }
    },
    async upload(remotePath, localPath) {
      const file = new File(Paths.document, localPath);
      const bytes = await file.bytes();
      const { error } = await bucket().upload(remotePath, bytes, {
        upsert: true,
        contentType: file.type || 'application/octet-stream',
      });
      if (error) throw error;
    },
    async download(remotePath, localPath) {
      const { data, error } = await bucket().createSignedUrl(remotePath, 120);
      if (error || !data) return false; // pas encore envoyé par l'autre appareil
      const target = new File(Paths.document, localPath);
      new Directory(target.parentDirectory.uri).create({ intermediates: true, idempotent: true });
      await File.downloadFileAsync(data.signedUrl, target, { idempotent: true });
      return true;
    },
    async remove(remotePath) {
      const { error } = await bucket().remove([remotePath]);
      if (error) throw error;
    },
  };
}

/**
 * Pièces jointes et photo de profil : les fichiers suivent les lignes.
 * Présent sur le téléphone et pas encore envoyé → envoi ; absent du téléphone → téléchargement
 * (même s'il a déjà été envoyé : après une sauvegarde restaurée sur un autre téléphone, la fiche
 * dit « envoyé » mais le fichier n'est pas là).
 * Un fichier envoyé que plus aucune ligne vivante ne référence (pièce jointe supprimée, photo de
 * profil remplacée) est retiré du serveur.
 * Chemin sur le serveur : <id utilisateur>/<chemin local> (la règle du bucket l'impose).
 * Les photos de progression physique (habit_checkpoints) ne sont volontairement PAS envoyées :
 * elles restent sur le téléphone.
 */
export async function syncFiles(db: Db, userId: string, store: FileStore): Promise<number> {
  const rows = await db.getAllAsync<{ path: string }>(
    `SELECT local_path AS path FROM attachments WHERE deleted_at IS NULL
     UNION SELECT photo_path AS path FROM profiles WHERE deleted_at IS NULL AND photo_path IS NOT NULL`,
    [],
  );
  const done = new Set(
    (await db.getAllAsync<{ path: string }>('SELECT path FROM sync_files', [])).map((r) => r.path),
  );
  let moved = 0;
  const alive = new Set(rows.map((r) => r.path));
  // Déjà envoyé mais plus référencé par une ligne vivante : on l'efface aussi du serveur.
  for (const path of done) {
    if (!path || alive.has(path) || path.includes('..')) continue;
    try {
      await store.remove(`${userId}/${path}`);
      await db.runAsync('DELETE FROM sync_files WHERE path = ?', [path]);
      moved++;
    } catch (e) {
      logger.error(e, { where: 'syncFiles.remove' });
    }
  }
  for (const { path } of rows) {
    if (!path || path.includes('..')) continue;
    const local = store.existsLocally(path);
    if (done.has(path) && local) continue;
    const remote = `${userId}/${path}`;
    try {
      if (local) await store.upload(remote, path);
      else if (!(await store.download(remote, path))) continue;
      await db.runAsync('INSERT OR REPLACE INTO sync_files (path, synced_at) VALUES (?, ?)', [
        path,
        nowIso(),
      ]);
      moved++;
    } catch (e) {
      logger.error(e, { where: 'syncFiles' });
    }
  }
  return moved;
}
