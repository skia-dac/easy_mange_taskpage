import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import type { WidgetData, WidgetTimelineEntry } from '@/projections';
import { logger } from '@/shared/logger';

import { requestWidgetUpdate } from './android/widgetNative';
import { ANDROID_WIDGETS, renderAndroidWidget } from './android/widgets';
import { readWidgetConfig, writeWidgetSnapshot } from './snapshot';

type IosRegistry = typeof import('./ios/registry');

let iosRegistry: IosRegistry | null | undefined;

/**
 * Chargé à la demande : expo-widgets lève dès l'évaluation du module dans Expo Go
 * (module natif ExpoWidgets absent). On vérifie d'abord sa présence : en développement,
 * Metro signale une erreur de chargement comme plantage même si elle est attrapée.
 */
function loadIosRegistry(): IosRegistry | null {
  if (iosRegistry !== undefined) return iosRegistry;
  if (!requireOptionalNativeModule('ExpoWidgets')) {
    iosRegistry = null;
    return iosRegistry;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    iosRegistry = require('./ios/registry') as IosRegistry;
  } catch {
    iosRegistry = null;
  }
  return iosRegistry;
}

/** Démarre, met à jour ou termine la Live Activity « Révision » selon la session en cours. */
function syncStudyActivity(StudyActivity: IosRegistry['StudyActivity'], current: WidgetData): void {
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
      const ios = loadIosRegistry();
      if (!ios) return;
      for (const w of ios.IOS_WIDGETS) w.updateTimeline(timeline);
      syncStudyActivity(ios.StudyActivity, current);
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
