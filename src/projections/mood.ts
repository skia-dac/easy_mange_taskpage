import {
  isDone,
  isScheduledOn,
  logOn,
  moodByHabit,
  summarizeMood,
  type Habit,
  type HabitLog,
  type MoodCorrelation,
  type MoodLog,
  type MoodSummary,
} from '@/modules/productivity';
import { addDaysIso, type IsoDate } from '@/shared/dates';

export type HabitMoodInsight = { habit: Habit } & MoodCorrelation;

export type MoodInsights = {
  week: MoodSummary;
  month: MoodSummary;
  /** Habitudes pour lesquelles on a assez de jours pour comparer (au moins 2 de chaque côté). */
  habits: HabitMoodInsight[];
};

/**
 * Journal d'humeur relié aux habitudes : pour chaque habitude quotidienne ou prévue ces jours-là,
 * on compare l'énergie et l'humeur des jours « faits » et des jours « pas faits » (30 derniers jours).
 * C'est une indication, pas une preuve : l'écran le dit.
 */
export function moodInsights(
  moodLogs: readonly MoodLog[],
  habits: readonly Habit[],
  habitLogs: readonly HabitLog[],
  today: IsoDate,
): MoodInsights {
  const monthFrom = addDaysIso(today, -29);
  const weekFrom = addDaysIso(today, -6);
  const month = moodLogs.filter((l) => l.date >= monthFrom && l.date <= today);
  const insights: HabitMoodInsight[] = [];
  for (const habit of habits) {
    const scheduled = month.filter((l) => isScheduledOn(habit, l.date));
    const done = new Set(
      scheduled.filter((l) => isDone(habit, logOn(habitLogs, habit.id, l.date))).map((l) => l.date),
    );
    const c = moodByHabit(scheduled, done);
    if (c.energyDone !== null) insights.push({ habit, ...c });
  }
  return {
    week: summarizeMood(month.filter((l) => l.date >= weekFrom)),
    month: summarizeMood(month),
    habits: insights,
  };
}
