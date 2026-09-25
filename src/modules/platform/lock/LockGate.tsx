import Feather from '@expo/vector-icons/Feather';
import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Modal, View } from 'react-native';

import { isAppLockEnabled } from '@/modules/identity';
import { settingTable, subscribeToChanges, useDb } from '@/shared/db';
import { logger } from '@/shared/logger';
import { useTheme } from '@/shared/theme';
import { AppText, Button } from '@/shared/ui';

/** Le verrou se réactive après ce délai en arrière-plan (pas à chaque changement d'app). */
const RELOCK_AFTER_MS = 30_000;

/** Face ID / Touch ID / code disponibles et configurés sur ce téléphone ? */
export async function canUseAppLock(): Promise<boolean> {
  try {
    return (
      (await LocalAuthentication.hasHardwareAsync()) &&
      (await LocalAuthentication.isEnrolledAsync())
    );
  } catch {
    return false;
  }
}

async function authenticate(prompt: string, cancel: string): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      cancelLabel: cancel,
      disableDeviceFallback: false,
    });
    return r.success;
  } catch (e) {
    logger.error(e, { where: 'authenticate' });
    return false;
  }
}

/**
 * Verrouillage de l'app (réglage « Verrouiller MySky ») : écran opaque au lancement et après
 * 30 s en arrière-plan, jusqu'à Face ID / Touch ID / code du téléphone.
 */
export function LockGate() {
  const { t } = useTranslation();
  const db = useDb();
  const { colors, spacing } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [locked, setLocked] = useState(false);
  const hiddenAt = useRef<number | null>(null);
  const busy = useRef(false);

  const unlock = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    const ok = await authenticate(t('lock.prompt'), t('common.cancel'));
    busy.current = false;
    if (ok) setLocked(false);
  }, [t]);

  useEffect(() => {
    let first = true;
    const apply = (on: boolean) => {
      setEnabled(on);
      // Verrou activé au démarrage : on demande tout de suite.
      if (on && first) {
        setLocked(true);
        void unlock();
      }
      first = false;
    };
    // Réglage illisible : on verrouille par prudence plutôt que de laisser l'app ouverte.
    const load = () =>
      void isAppLockEnabled(db).then(apply, (e: unknown) => {
        logger.error(e, { where: 'LockGate' });
        apply(true);
      });
    load();
    return subscribeToChanges((tables) => tables.has(settingTable('app_lock')) && load());
  }, [db, unlock]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background' || s === 'inactive') {
        hiddenAt.current ??= Date.now();
      } else if (s === 'active') {
        const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
        hiddenAt.current = null;
        if (away >= RELOCK_AFTER_MS) {
          setLocked(true);
          void unlock();
        }
      }
    });
    return () => sub.remove();
  }, [enabled, unlock]);

  if (!enabled || !locked) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={() => undefined}>
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xxl,
          gap: spacing.lg,
        }}
      >
        <Feather name="lock" size={48} color={colors.primary} />
        <AppText variant="title" style={{ textAlign: 'center' }}>
          {t('lock.title')}
        </AppText>
        <AppText color="muted" style={{ textAlign: 'center' }}>
          {t('lock.message')}
        </AppText>
        <Button label={t('lock.unlock')} onPress={() => void unlock()} />
      </View>
    </Modal>
  );
}
