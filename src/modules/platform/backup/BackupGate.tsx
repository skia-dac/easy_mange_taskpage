import { useEffect } from 'react';
import { AppState } from 'react-native';

import { useDb } from '@/shared/db';
import { logger } from '@/shared/logger';

import { autoBackupIfDue } from './files';

/**
 * Composant sans affichage : lance la sauvegarde automatique quotidienne
 * après l'ouverture de l'app et à chaque retour au premier plan.
 */
export function BackupGate() {
  const db = useDb();
  useEffect(() => {
    const run = () => {
      void autoBackupIfDue(db).catch((e: unknown) => logger.error(e, { where: 'autoBackup' }));
    };
    const timer = setTimeout(run, 3000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [db]);
  return null;
}
