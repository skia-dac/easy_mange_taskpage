import { useTranslation } from 'react-i18next';

import type { Countdown, CourseType } from '@/modules/academic';
import type { Priority, WorkStatus } from '@/modules/productivity';
import { formatDuration, weekdayName } from '@/shared/format';

/** Textes traduits pour les valeurs métier (types de cours, priorités, comptes à rebours…). */
export function useLabels() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  return {
    lang,
    courseType: (v: CourseType) => t(`courseType.${v}`),
    priority: (v: Priority) => t(`priority.${v}`),
    status: (v: WorkStatus) => t(`status.${v}`),
    weekday: (n: number, style: 'short' | 'long' = 'long') => weekdayName(n, lang, style),
    duration: formatDuration,
    countdown: (c: Countdown) =>
      c.kind === 'inDays' ? t('countdown.inDays', { count: c.days }) : t(`countdown.${c.kind}`),
  };
}
