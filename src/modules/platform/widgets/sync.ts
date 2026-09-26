import { Platform } from 'react-native';

import type { WidgetData, WidgetTimelineEntry } from '@/projections';
import { logger } from '@/shared/logger';

import { requestWidgetUpdate } from './android/widgetNative';
import { ANDROID_WIDGETS, renderAndroidWidget } from './android/widgets';
import ExamsWidget from './ios/ExamsWidget';
import GradesWidget from './ios/GradesWidget';
import HabitsWidget from './ios/HabitsWidget';
import MoneyLeftWidget from './ios/MoneyLeftWidget';
import MoneyQuickWidget from './ios/MoneyQuickWidget';
import MoneyWeekWidget from './ios/MoneyWeekWidget';
import MonthWidget from './ios/MonthWidget';
import NextCourseWidget from './ios/NextCourseWidget';
import ProgressWidget from './ios/ProgressWidget';
import QuickAddWidget from './ios/QuickAddWidget';
import StudyActivity from './ios/StudyActivity';
import SubjectWidget from './ios/SubjectWidget';
import TasksWidget from './ios/TasksWidget';
import TodayWidget from './ios/TodayWidget';
import WeekWidget from './ios/WeekWidget';
import { readWidgetConfig, writeWidgetSnapshot } from './snapshot';

const IOS_WIDGETS = [
  NextCourseWidget,
  TodayWidget,
  TasksWidget,
  WeekWidget,
  SubjectWidget,
  ExamsWidget,
  QuickAddWidget,
  GradesWidget,
  MonthWidget,
  HabitsWidget,
  MoneyQuickWidget,
  MoneyLeftWidget,
  MoneyWeekWidget,
  ProgressWidget,
];

/** Démarre, met à jour ou termine la Live Activity « Révision » selon la session en cours. */
function syncStudyActivity(current: WidgetData): void {
  const instances = StudyActivity.getInstances();
  const study = current.study;
  const props = study
    ? {
        study,
        labels: {
          studyRunning: current.labels.studyRunning,
          breakRunning: current.labels.breakRunning,
          untilTime: current.labels.untilTime,
        },
        light: current.light,
        dark: current.dark,
      }
    : null;
  if (!props) {
    for (const i of instances) void i.end('immediate');
    return;
  }
  if (instances.length === 0) {
    StudyActivity.start(props, current.links.study, new Date(study!.endsAt));
    return;
  }
  instances.forEach((i, idx) => {
    if (idx === 0) void i.update(props, new Date(study!.endsAt));
    else void i.end('immediate');
  });
}

/**
 * Pousse les données vers les widgets de l'écran d'accueil.
 * iPhone : une chronologie (le widget change seul aux heures de début / fin de séance).
 * Android : rendu immédiat de chaque widget posé, plus une photo pour la tâche de fond.
 */
export async function syncWidgets(timeline: WidgetTimelineEntry[]): Promise<void> {
  const current = timeline[0]?.props;
  if (!current) return;
  try {
    if (Platform.OS === 'ios') {
      for (const w of IOS_WIDGETS) w.updateTimeline(timeline);
      syncStudyActivity(current);
    } else if (Platform.OS === 'android') {
      writeWidgetSnapshot(current);
      const config = readWidgetConfig();
      await Promise.all(
        ANDROID_WIDGETS.map((name) =>
          requestWidgetUpdate({
            widgetName: name,
            renderWidget: (info) =>
              renderAndroidWidget(name, current, {
                subjectId: config[String(info.widgetId)]?.subjectId ?? null,
              }),
          }),
        ),
      );
    }
  } catch (e) {
    // Sans build de développement (Expo Go), les modules natifs des widgets n'existent pas.
    logger.warn('Widgets non mis à jour', { where: 'syncWidgets' });
    logger.error(e, { where: 'syncWidgets' });
  }
}

/** Pour l'affichage dans les réglages : les widgets sont-ils disponibles dans ce build ? */
export function widgetsAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export type { WidgetData };
