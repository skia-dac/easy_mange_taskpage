import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useConflictCount } from '@/hooks/useConflictCount';
import { showToast } from '@/shared/ui';

/**
 * Composant sans affichage : quand une synchronisation fait apparaître de **nouveaux** conflits,
 * un message le dit une fois, avec « Voir » vers l'écran des conflits. Les conflits déjà connus
 * à l'ouverture de l'app ne sont pas réannoncés (le badge du profil les rappelle).
 */
export function ConflictsGate() {
  const { t } = useTranslation();
  const count = useConflictCount();
  // Nombre déjà connu : null avant la première lecture.
  const known = useRef<number | null>(null);

  useEffect(() => {
    if (count === undefined) return;
    const before = known.current;
    known.current = count;
    if (before === null || count <= before) return;
    showToast(t('conflicts.newToast', { count: count - before }), {
      label: t('conflicts.see'),
      onPress: () => router.push('/account/conflicts'),
    });
  }, [count, t]);

  return null;
}
