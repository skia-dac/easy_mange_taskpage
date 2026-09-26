import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { useSubjects } from '@/hooks/useSubjects';
import { useSpaces } from '@/shared/SpacesContext';
import { useWeekStart } from '@/hooks/useWeekStart';
import { getProgressWidgetHabit } from '@/modules/identity';
import { listStudySessions } from '@/modules/productivity';
import { buildWidgetMoney, buildWidgetTimeline, useAgendaData, useMoneyData } from '@/projections';
import { addDaysIso, toIsoDate } from '@/shared/dates';
import { useLiveQuery } from '@/shared/db';
import {
  formatDuration,
  formatLongDate,
  formatMonthYear,
  formatShortDate,
  weekdayName,
} from '@/shared/format';
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
  const money = useMoneyData(0);
  const moneyData = money.data;
  const progressQ = useLiveQuery(getProgressWidgetHabit, ['app_settings'], []);
  const progressHabitId = progressQ.data ?? null;
  // Un espace coupé n'apparaît pas non plus sur l'écran d'accueil : ni argent, ni révision, ni matières.
  const spaces = useSpaces();
  const study = spaces.has('study');
  const personal = spaces.has('personal');

  useEffect(() => {
    if (!data || loading || !sessionList) return;
    const run = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const timeline = buildWidgetTimeline(
          data,
          study ? byId : new Map(),
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
          {
            progressHabitId,
            sessions: study ? sessionList : [],
            weekStart,
            scheme,
            money:
              personal && moneyData
                ? buildWidgetMoney(
                    moneyData.overview,
                    moneyData.input.categories,
                    moneyData.prefs.hideWidgetAmounts,
                    {
                      t: (key, params) => t(key, params),
                      weekdayShort: (n) => weekdayName(n, lang, 'short'),
                      shortDate: (iso) => formatShortDate(iso, lang),
                    },
                  )
                : undefined,
          },
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
  }, [
    data,
    byId,
    loading,
    t,
    lang,
    sessionList,
    weekStart,
    scheme,
    moneyData,
    progressHabitId,
    study,
    personal,
  ]);

  return null;
}
