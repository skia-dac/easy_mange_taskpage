import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { useSubjects } from '@/hooks/useSubjects';
import { useWeekStart } from '@/hooks/useWeekStart';
import { listStudySessions } from '@/modules/productivity';
import { buildWidgetTimeline, useAgendaData } from '@/projections';
import { addDaysIso, toIsoDate } from '@/shared/dates';
import { useLiveQuery } from '@/shared/db';
import { formatDuration, formatLongDate, formatMonthYear, weekdayName } from '@/shared/format';
import { darkColors, lightColors, useTheme } from '@/shared/theme';

import { syncWidgets } from './sync';

/**
 * Composant sans affichage : recalcule les widgets à chaque changement de données,
 * et au retour de l'app au premier plan (avec un léger délai pour regrouper les changements).
 */
export function WidgetsGate() {
  const { t, i18n } = useTranslation();
  const agenda = useAgendaData();
  const { byId, loading } = useSubjects();
  const weekStart = useWeekStart();
  const { scheme } = useTheme();
  const today = toIsoDate(new Date());
  const sessions = useLiveQuery(
    (db) => listStudySessions(db, addDaysIso(today, -400), addDaysIso(today, 7)),
    ['study_sessions'],
    [today],
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const data = agenda.data;
  const lang = i18n.language;
  const sessionList = sessions.data;

  useEffect(() => {
    if (!data || loading || !sessionList) return;
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
            weekdayShort: (n) => weekdayName(n, lang, 'short'),
            monthTitle: (day) => formatMonthYear(day, lang),
            duration: formatDuration,
            locale: lang,
          },
          { light: lightColors, dark: darkColors },
          { sessions: sessionList, weekStart, scheme },
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
  }, [data, byId, loading, t, lang, sessionList, weekStart, scheme]);

  return null;
}
