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

/** Réglage par widget Android (id → matière choisie), pour le widget « Matière ». */
const CONFIG_FILE = 'widget-config.json';
export type WidgetConfigMap = Record<string, { subjectId: string | null }>;

export function readWidgetConfig(): WidgetConfigMap {
  try {
    const f = new File(Paths.document, CONFIG_FILE);
    if (!f.exists) return {};
    const parsed: unknown = JSON.parse(f.textSync());
    return parsed && typeof parsed === 'object' ? (parsed as WidgetConfigMap) : {};
  } catch {
    return {};
  }
}

export function writeWidgetConfig(widgetId: number, subjectId: string | null): void {
  try {
    const map = readWidgetConfig();
    map[String(widgetId)] = { subjectId };
    new File(Paths.document, CONFIG_FILE).write(JSON.stringify(map));
  } catch (e) {
    logger.error(e, { where: 'writeWidgetConfig' });
  }
}
