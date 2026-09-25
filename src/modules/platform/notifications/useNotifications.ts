import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useAgendaData } from '@/projections';
import { subscribeToChanges, useDb } from '@/shared/db';
import { logger } from '@/shared/logger';

import { routeForResponse } from './route';
import {
  addResponseListener,
  clearLastResponse,
  configureNotifications,
  getLastResponse,
  readResponse,
  syncScheduledNotifications,
} from './scheduler';

/**
 * À monter une fois (layout racine) :
 * - configure les notifications ;
 * - reprogramme les rappels quand les données ou les réglages changent, et au retour de l'app ;
 * - ouvre le bon écran quand l'utilisateur touche une notification.
 */
export function useNotifications(): void {
  const db = useDb();
  const agenda = useAgendaData();
  const data = agenda.data;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void configureNotifications().catch((e: unknown) =>
      logger.error(e, { where: 'configureNotifications' }),
    );
  }, []);

  // Reprogrammation (avec un léger délai pour regrouper plusieurs changements).
  useEffect(() => {
    if (!data) return;
    const sync = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        void syncScheduledNotifications(db, data).catch((e: unknown) =>
          logger.error(e, { where: 'syncScheduledNotifications' }),
        );
      }, 800);
    };
    sync();
    const unsubscribe = subscribeToChanges((tables) => tables.has('app_settings') && sync());
    const appState = AppState.addEventListener('change', (s) => s === 'active' && sync());
    return () => {
      unsubscribe();
      appState.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [db, data]);

  // Réponses aux notifications (app ouverte, ou lancée depuis une notification).
  useEffect(() => {
    const handle = (r: ReturnType<typeof readResponse>) => {
      if (!r) return;
      const href = routeForResponse(r);
      if (href) router.push(href);
    };
    void getLastResponse().then((last) => {
      handle(readResponse(last));
      if (last) void clearLastResponse();
    });
    const sub = addResponseListener((response) => handle(readResponse(response)));
    return () => sub.remove();
  }, []);
}
