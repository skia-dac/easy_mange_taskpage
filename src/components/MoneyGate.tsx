import { useEffect } from 'react';
import { AppState } from 'react-native';

import { recordDuePayouts } from '@/modules/finance';
import { toIsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { logger } from '@/shared/logger';

/**
 * Composant sans affichage : à l'ouverture et au retour dans l'app, les tours de tontine arrivés
 * sont ajoutés aux entrées d'argent (si « compter automatiquement » est activé).
 */
export function MoneyGate() {
  const db = useDb();
  useEffect(() => {
    const run = () => {
      void recordDuePayouts(db, toIsoDate(new Date())).catch((e: unknown) =>
        logger.error(e, { where: 'money.payouts' }),
      );
    };
    const timer = setTimeout(run, 2000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [db]);
  return null;
}
