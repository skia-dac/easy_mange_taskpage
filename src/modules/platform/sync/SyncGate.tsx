import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/modules/identity';
import { SYNCED_TABLES, subscribeToChanges, useDb } from '@/shared/db';

import { cancelSyncRetry, runSync } from './runner';

const AFTER_CHANGE_MS = 4000;
const EVERY_MS = 5 * 60 * 1000;

/**
 * Composant sans affichage : quand un compte est connecté (et que ce téléphone lui appartient),
 * synchronise au lancement, au retour de l'app, quelques secondes après une modification,
 * et toutes les 5 minutes.
 */
export function SyncGate({ ready }: { ready: boolean }) {
  const db = useDb();
  const { userId } = useAuth();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId || !ready) return;
    const now = () => void runSync(db, userId);
    const soon = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(now, AFTER_CHANGE_MS);
    };
    now();
    const watched = new Set<string>(SYNCED_TABLES);
    const unsubscribe = subscribeToChanges((tables) => {
      for (const t of tables) if (watched.has(t)) return soon();
    });
    const app = AppState.addEventListener('change', (s) => s === 'active' && now());
    const every = setInterval(() => AppState.currentState === 'active' && now(), EVERY_MS);
    return () => {
      unsubscribe();
      app.remove();
      clearInterval(every);
      if (timer.current) clearTimeout(timer.current);
      // Déconnexion ou changement de compte : aucune reprise ne doit tourner pour l'ancien compte.
      cancelSyncRetry();
    };
  }, [db, userId, ready]);

  return null;
}
