import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable } from 'react-native';

import type { Subject } from '@/modules/academic';
import { buildIcs, shareIcs } from '@/modules/platform';
import type { TodayData } from '@/projections';
import { userMessageKey } from '@/shared/errors';
import { minTouchSize, useTheme } from '@/shared/theme';
import { showError } from '@/shared/ui';

type Props = { data: TodayData | undefined; subjects: Map<string, Subject> };

/** Bouton « Exporter » du calendrier : fichier .ics à ouvrir dans Calendrier iPhone / Google Agenda. */
export function ExportCalendarButton({ data, subjects }: Props) {
  const { t } = useTranslation();
  const { colors, radius } = useTheme();
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (!data || busy) return;
    setBusy(true);
    try {
      const ics = buildIcs(data, {
        subjectName: (id) => subjects.get(id)?.name ?? '',
        exam: t('calendarItem.exam'),
        assignment: t('calendarItem.assignment'),
        revision: t('calendarItem.revision'),
        task: t('calendarItem.task'),
      });
      if (!(await shareIcs(ics, t('calendar.exportTitle')))) showError('backup.shareUnavailable');
    } catch (e) {
      showError(userMessageKey(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('calendar.export')}
      onPress={() => void share()}
      disabled={busy || !data}
      style={({ pressed }) => ({
        width: minTouchSize,
        height: minTouchSize,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed || busy ? 0.7 : 1,
      })}
    >
      <Feather name="share" size={20} color={colors.text} />
    </Pressable>
  );
}
