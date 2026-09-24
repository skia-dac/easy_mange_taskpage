import {
  cancelAllReminders,
  clearDatabase,
  deleteAllAttachments,
  deleteAllBackups,
} from '@/modules/platform';
import type { Db } from '@/shared/db';
import { logger } from '@/shared/logger';

/**
 * « Supprimer toutes mes données » : rappels annulés, base vidée (réglages compris),
 * pièces jointes et sauvegardes locales effacées. L'app repart comme au premier lancement.
 * À n'appeler qu'après confirmation explicite de l'utilisateur.
 */
export async function wipeAllData(db: Db): Promise<void> {
  await cancelAllReminders().catch((e: unknown) => logger.error(e, { where: 'wipe.reminders' }));
  await clearDatabase(db);
  deleteAllAttachments();
  deleteAllBackups();
}
