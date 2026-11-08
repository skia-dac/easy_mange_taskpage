import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** iPhone : filet de sécurité si `onDismiss` n'arrive pas (fenêtre démontée avant la fin). */
export const AFTER_DISMISS_IOS_FALLBACK_MS = 1000;

/**
 * Lancer une action (navigation, alerte) une fois une `Modal` fermée : sur iPhone, ce qui est
 * présenté pendant qu'une fenêtre disparaît peut être ignoré par le système. iOS : à `onDismiss`
 * (à passer à la Modal), avec un filet de sécurité. Android : après `androidDelayMs` (pas
 * d'`onDismiss` ; 0 pour une fenêtre sans animation). Une seule action à la fois ; annulée si
 * l'écran est démonté.
 */
export function useAfterDismiss(androidDelayMs = 0) {
  const pending = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const action = pending.current;
    pending.current = null;
    action?.();
  }, []);

  const schedule = useCallback(
    (action: () => void) => {
      if (pending.current) return;
      pending.current = action;
      timer.current = setTimeout(
        run,
        Platform.OS === 'ios' ? AFTER_DISMISS_IOS_FALLBACK_MS : androidDelayMs,
      );
    },
    [androidDelayMs, run],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pending.current = null;
    },
    [],
  );

  return { schedule, onDismiss: Platform.OS === 'ios' ? run : undefined };
}
