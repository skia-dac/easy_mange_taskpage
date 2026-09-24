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
  };
}

/**
 * Pièces jointes et photo de profil : les fichiers suivent les lignes.
 * Présent sur le téléphone et pas encore envoyé → envoi ; absent → téléchargement.
 * Chemin sur le serveur : <id utilisateur>/<chemin local> (la règle du bucket l'impose).
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
  for (const { path } of rows) {
    if (!path || done.has(path) || path.includes('..')) continue;
    const remote = `${userId}/${path}`;
    try {
      if (store.existsLocally(path)) await store.upload(remote, path);
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
