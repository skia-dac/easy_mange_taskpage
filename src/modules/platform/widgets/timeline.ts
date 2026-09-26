import type { WidgetData } from '@/projections';

/** Entrée de chronologie telle qu'écrite dans le fichier partagé avec la tâche de fond Android. */
export type WidgetSnapshotEntry = { date: string; props: WidgetData };

/**
 * Entrée à afficher à l'instant `now` : la plus récente dont la date est passée (`date <= now`).
 * Si toutes sont dans le futur (horloge reculée), on prend la première ; sans entrée, `null`.
 */
export function pickTimelineEntry<T extends { date: string | Date }>(
  entries: readonly T[],
  now: Date,
): T | null {
  if (entries.length === 0) return null;
  const at = now.getTime();
  let best: T | null = null;
  let bestTime = Number.NEGATIVE_INFINITY;
  for (const entry of entries) {
    const time = new Date(entry.date).getTime();
    if (Number.isNaN(time) || time > at) continue;
    if (time >= bestTime) {
      best = entry;
      bestTime = time;
    }
  }
  return best ?? entries[0] ?? null;
}
