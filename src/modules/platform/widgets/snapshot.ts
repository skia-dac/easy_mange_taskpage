import { File, Paths } from 'expo-file-system';

import type { WidgetData } from '@/projections';
import { logger } from '@/shared/logger';

/** Dernières données de widget, écrites par l'app et relues par la tâche de fond Android. */
const FILE_NAME = 'widget-snapshot.json';

export function writeWidgetSnapshot(data: WidgetData): void {
  try {
    new File(Paths.document, FILE_NAME).write(JSON.stringify(data));
  } catch (e) {
    logger.error(e, { where: 'writeWidgetSnapshot' });
  }
}

export function readWidgetSnapshot(): WidgetData | null {
  try {
    const f = new File(Paths.document, FILE_NAME);
    if (!f.exists) return null;
    return JSON.parse(f.textSync()) as WidgetData;
  } catch (e) {
    logger.error(e, { where: 'readWidgetSnapshot' });
    return null;
  }
}
