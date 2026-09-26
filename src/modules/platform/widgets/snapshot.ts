import { File, Paths } from 'expo-file-system';

import type { WidgetTimelineEntry } from '@/projections';
import { logger } from '@/shared/logger';

import { pickTimelineEntry, type WidgetSnapshotEntry } from './timeline';

/**
 * Chronologie complète des widgets (liste `{date, props}`), écrite par l'app et relue par la
 * tâche de fond Android, qui choisit à chaque rendu l'entrée correspondant à l'heure courante.
 */
const FILE_NAME = 'widget-snapshot.json';

export function writeWidgetSnapshot(timeline: readonly WidgetTimelineEntry[]): void {
  try {
    const entries: WidgetSnapshotEntry[] = timeline.map((e) => ({
      date: e.date.toISOString(),
      props: e.props,
    }));
    new File(Paths.document, FILE_NAME).write(JSON.stringify(entries));
  } catch (e) {
    logger.error(e, { where: 'writeWidgetSnapshot' });
  }
}

export function readWidgetSnapshot(): WidgetSnapshotEntry[] {
  try {
    const f = new File(Paths.document, FILE_NAME);
    if (!f.exists) return [];
    const parsed: unknown = JSON.parse(f.textSync());
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is WidgetSnapshotEntry =>
        !!e && typeof e === 'object' && typeof (e as WidgetSnapshotEntry).date === 'string',
    );
  } catch (e) {
    logger.error(e, { where: 'readWidgetSnapshot' });
    return [];
  }
}

/** Données à afficher maintenant, d'après la dernière chronologie écrite par l'app. */
export function readCurrentWidgetData(now: Date = new Date()) {
  return pickTimelineEntry(readWidgetSnapshot(), now)?.props ?? null;
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

function saveWidgetConfig(map: WidgetConfigMap): void {
  new File(Paths.document, CONFIG_FILE).write(JSON.stringify(map));
}

export function writeWidgetConfig(widgetId: number, subjectId: string | null): void {
  try {
    const map = readWidgetConfig();
    map[String(widgetId)] = { subjectId };
    saveWidgetConfig(map);
  } catch (e) {
    logger.error(e, { where: 'writeWidgetConfig' });
  }
}

/** Oublie le réglage d'un widget retiré de l'écran d'accueil. */
export function removeWidgetConfig(widgetId: number): void {
  try {
    const map = readWidgetConfig();
    if (!(String(widgetId) in map)) return;
    delete map[String(widgetId)];
    saveWidgetConfig(map);
  } catch (e) {
    logger.error(e, { where: 'removeWidgetConfig' });
  }
}
