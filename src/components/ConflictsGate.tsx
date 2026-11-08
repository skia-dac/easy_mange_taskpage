import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useConflictIds } from '@/hooks/useConflictCount';
import { showToast } from '@/shared/ui';

/**
 * Composant sans affichage : quand une synchronisation fait apparaître de **nouveaux** conflits,
 * un message le dit une fois, avec « Voir » vers l'écran des conflits. Les conflits déjà connus
 * à l'ouverture de l'app ne sont pas réannoncés (le badge du profil les rappelle). On compare
 * les ids, pas le nombre : un conflit réglé et un nouveau dans la même synchronisation sont
 * bien annoncés.
 */
export function ConflictsGate() {
  const { t } = useTranslation();
  const ids = useConflictIds();
  // Conflits déjà connus : null avant la première lecture.
  const known = useRef<ReadonlySet<string> | null>(null);

  useEffect(() => {
    if (ids === undefined) return;
    const before = known.current;
    known.current = new Set(ids);
    if (before === null) return;
    const added = ids.filter((id) => !before.has(id)).length;
    if (added === 0) return;
    showToast(t('conflicts.newToast', { count: added }), {
      label: t('conflicts.see'),
      onPress: () => router.push('/account/conflicts'),
    });
  }, [ids, t]);

  return null;
}
