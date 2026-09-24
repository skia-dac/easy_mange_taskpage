import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { useSubjects } from '@/hooks/useSubjects';
import { buildWidgetTimeline, useAgendaData } from '@/projections';
import { formatLongDate } from '@/shared/format';
import { darkColors, lightColors } from '@/shared/theme';

import { syncWidgets } from './sync';

/**
 * Composant sans affichage : recalcule les widgets à chaque changement de données,
 * et au retour de l'app au premier plan (avec un léger délai pour regrouper les changements).
 */
export function WidgetsGate() {
  const { t, i18n } = useTranslation();
  const agenda = useAgendaData();
  const { byId, loading } = useSubjects();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const data = agenda.data;
  const lang = i18n.language;

  useEffect(() => {
    if (!data || loading) return;
    const run = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const timeline = buildWidgetTimeline(
          data,
          byId,
          new Date(),
          {
            t: (key, params) => t(key, params),
            formatDate: (d) => formatLongDate(d, lang),
            subjectName: (id) => byId.get(id)?.name ?? '',
          },
          { light: lightColors, dark: darkColors },
        );
        void syncWidgets(timeline);
      }, 1200);
    };
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => {
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [data, byId, loading, t, lang]);

  return null;
}
