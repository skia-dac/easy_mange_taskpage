import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import type { WidgetData, WidgetTimelineEntry } from '@/projections';
import { logger } from '@/shared/logger';

import { ANDROID_WIDGETS, renderAndroidWidget } from './android/widgets';
import NextCourseWidget from './ios/NextCourseWidget';
import TasksWidget from './ios/TasksWidget';
import TodayWidget from './ios/TodayWidget';
import { writeWidgetSnapshot } from './snapshot';

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
      for (const w of [NextCourseWidget, TodayWidget, TasksWidget]) w.updateTimeline(timeline);
    } else if (Platform.OS === 'android') {
      writeWidgetSnapshot(current);
      await Promise.all(
        ANDROID_WIDGETS.map((name) =>
          requestWidgetUpdate({
            widgetName: name,
            renderWidget: () => renderAndroidWidget(name, current),
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
