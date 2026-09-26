import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getSupabase, useAuth } from '@/modules/identity';
import { useDb } from '@/shared/db';
import { logger } from '@/shared/logger';

import { sendPendingFeedback } from './service';

/** Laisse l'app démarrer avant le premier essai. */
const START_DELAY_MS = 5000;

/**
 * Composant sans affichage : renvoie les retours « en attente d'envoi » au lancement, au retour
 * au premier plan et à la connexion (une capture jointe ne part qu'avec un compte connecté).
 * Sans serveur configuré, il ne fait rien (le retour part par e-mail depuis l'écran).
 */
export function FeedbackGate() {
  const db = useDb();
  const { userId } = useAuth();
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    const run = () => {
      void sendPendingFeedback(db, client).catch((e: unknown) =>
        logger.error(e, { where: 'feedbackGate' }),
      );
    };
    const timer = setTimeout(run, START_DELAY_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [db, userId]);
  return null;
}
