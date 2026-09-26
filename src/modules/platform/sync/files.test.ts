import { setProfilePhoto } from '@/modules/identity';
import { addAttachment, createNote, removeAttachment } from '@/modules/productivity';
import { createTestDb } from '@/test/memoryDb';

import { syncFiles, type FileStore } from './files';

/** Faux serveur de fichiers : ce qui existe sur le téléphone, ce qui est sur le serveur. */
function fakeStore(localFiles: Set<string>) {
  const remote = new Map<string, string>();
  const store: FileStore = {
    existsLocally: (p) => localFiles.has(p),
    upload: async (remotePath, localPath) => {
      remote.set(remotePath, localPath);
    },
    download: async (remotePath, localPath) => {
      if (!remote.has(remotePath)) return false;
      localFiles.add(localPath);
      return true;
    },
    remove: async (remotePath) => {
      remote.delete(remotePath);
    },
  };
  return { store, remote };
}

describe('synchronisation des fichiers', () => {
  it('envoie un fichier présent, télécharge un fichier absent, efface après suppression', async () => {
    const db = await createTestDb();
    const noteId = await createNote(db, { title: 'Cours', content: '' });
    const attachmentId = await addAttachment(db, noteId, {
      kind: 'image',
      name: 'photo.jpg',
      mimeType: 'image/jpeg',
      size: 10,
      localPath: 'attachments/n/photo.jpg',
    });
    await addAttachment(db, noteId, {
      kind: 'file',
      name: 'poly.pdf',
      mimeType: 'application/pdf',
      size: 20,
      localPath: 'attachments/n/poly.pdf',
    });
    const local = new Set(['attachments/n/photo.jpg']);
    const { store, remote } = fakeStore(local);
    remote.set('u1/attachments/n/poly.pdf', 'attachments/n/poly.pdf');

    expect(await syncFiles(db, 'u1', store)).toBe(2);
    expect(remote.has('u1/attachments/n/photo.jpg')).toBe(true);
    expect(local.has('attachments/n/poly.pdf')).toBe(true);
    // Déjà fait : rien à refaire.
    expect(await syncFiles(db, 'u1', store)).toBe(0);

    await removeAttachment(db, attachmentId);
    expect(await syncFiles(db, 'u1', store)).toBe(1);
    expect(remote.has('u1/attachments/n/photo.jpg')).toBe(false);
    expect(remote.has('u1/attachments/n/poly.pdf')).toBe(true);
    expect(await syncFiles(db, 'u1', store)).toBe(0);
    db.close();
  });

  it('ignore un chemin qui remonte hors du dossier et n’arrête pas les autres sur une erreur', async () => {
    const db = await createTestDb();
    const noteId = await createNote(db, { title: 'x', content: '' });
    await addAttachment(db, noteId, {
      kind: 'file',
      name: 'a',
      mimeType: null,
      size: null,
      localPath: '../secret.txt',
    });
    await addAttachment(db, noteId, {
      kind: 'file',
      name: 'b',
      mimeType: null,
      size: null,
      localPath: 'attachments/n/b.txt',
    });
    const { store, remote } = fakeStore(new Set(['../secret.txt', 'attachments/n/b.txt']));
    store.upload = async (remotePath, localPath) => {
      if (localPath.endsWith('b.txt')) throw new Error('réseau');
      remote.set(remotePath, localPath);
    };
    expect(await syncFiles(db, 'u1', store)).toBe(0);
    expect(remote.size).toBe(0);
    db.close();
  });

  it('sauvegarde restaurée : un fichier marqué envoyé mais absent du téléphone est téléchargé', async () => {
    const db = await createTestDb();
    const noteId = await createNote(db, { title: 'Cours', content: '' });
    await addAttachment(db, noteId, {
      kind: 'file',
      name: 'poly.pdf',
      mimeType: 'application/pdf',
      size: 20,
      localPath: 'attachments/n/poly.pdf',
    });
    // La fiche vient d'une sauvegarde : « déjà envoyé », mais le fichier n'est pas sur ce téléphone.
    await db.runAsync(
      "INSERT INTO sync_files (path, synced_at) VALUES ('attachments/n/poly.pdf', 'x')",
      [],
    );
    const local = new Set<string>();
    const { store, remote } = fakeStore(local);
    remote.set('u1/attachments/n/poly.pdf', 'attachments/n/poly.pdf');

    expect(await syncFiles(db, 'u1', store)).toBe(1);
    expect(local.has('attachments/n/poly.pdf')).toBe(true);
    expect(await syncFiles(db, 'u1', store)).toBe(0);
    db.close();
  });

  it('photo de profil remplacée : l’ancienne est retirée du serveur', async () => {
    const db = await createTestDb();
    await setProfilePhoto(db, 'profile/photo-1.jpg');
    const local = new Set(['profile/photo-1.jpg', 'profile/photo-2.jpg']);
    const { store, remote } = fakeStore(local);
    expect(await syncFiles(db, 'u1', store)).toBe(1);
    expect(remote.has('u1/profile/photo-1.jpg')).toBe(true);

    await setProfilePhoto(db, 'profile/photo-2.jpg');
    // Une opération par fichier : l'ancienne retirée, la nouvelle envoyée.
    expect(await syncFiles(db, 'u1', store)).toBe(2);
    expect(remote.has('u1/profile/photo-1.jpg')).toBe(false);
    expect(remote.has('u1/profile/photo-2.jpg')).toBe(true);
    const kept = await db.getAllAsync<{ path: string }>('SELECT path FROM sync_files', []);
    expect(kept.map((r) => r.path)).toEqual(['profile/photo-2.jpg']);
    expect(await syncFiles(db, 'u1', store)).toBe(0);
    db.close();
  });
});
