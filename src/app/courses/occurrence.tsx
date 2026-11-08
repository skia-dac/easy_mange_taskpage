import { Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/components/navigation';
import { EditLoadView } from '@/components/EditLoadView';
import { useEditLoad } from '@/hooks/useEditLoad';
import { useDirty, useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  getCourseException,
  getCourseSeries,
  overrideOccurrence,
  type OccurrenceOverrideInput,
} from '@/modules/academic';
import { useDb } from '@/shared/db';
import { formatLongDate } from '@/shared/format';
import { fromIsoDate } from '@/shared/dates';
import { useTheme } from '@/shared/theme';
import { AppText, DateTimeField, FormScreen, TextField, fieldLimits, useSave } from '@/shared/ui';

/** « Modifier uniquement ce cours » (§27 option 1) : un champ vide garde la valeur de la série. */
export default function OccurrenceFormScreen() {
  const { t, i18n } = useTranslation();
  const db = useDb();
  const { spacing } = useTheme();
  const { seriesId, date } = useLocalSearchParams<{ seriesId: string; date: string }>();
  const [form, setForm] = useState<OccurrenceOverrideInput>({
    seriesId,
    date,
    newStartTime: null,
    newEndTime: null,
    newRoom: '',
    newTeacher: '',
    newTitle: '',
    note: '',
  });
  const { errors, saving, run } = useSave();
  const set = (patch: Partial<OccurrenceOverrideInput>) => setForm((f) => ({ ...f, ...patch }));

  // Les champs n'apparaissent qu'une fois la séance lue : un cours supprimé est « introuvable »,
  // une modification déjà faite remplit le formulaire (jamais par-dessus une saisie).
  const load = useEditLoad(
    seriesId ? `${seriesId}:${date}` : undefined,
    async () => {
      const [series, ex] = await Promise.all([
        getCourseSeries(db, seriesId),
        getCourseException(db, seriesId, date),
      ]);
      if (!series) return null;
      return { ex: ex && ex.kind === 'modified' ? ex : null };
    },
    ({ ex }) => {
      if (ex) set({ ...ex });
    },
  );
  const { dirty } = useDirty(form, load.state === 'ready');
  const leave = useUnsavedGuard(dirty);

  const submit = () =>
    run(async () => {
      await overrideOccurrence(db, form);
      leave(goBack);
    });

  if (load.state !== 'ready')
    return (
      <EditLoadView state={load.state} onRetry={load.retry} title={t('occurrence.editTitle')} />
    );

  return (
    <FormScreen submitLabel={t('occurrence.save')} onSubmit={submit} saving={saving}>
      <Stack.Screen options={{ title: t('occurrence.editTitle') }} />
      <AppText variant="heading">{formatLongDate(fromIsoDate(date), i18n.language)}</AppText>
      <AppText color="muted">{t('occurrence.overrideHint')}</AppText>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <DateTimeField
            label={t('courses.start')}
            mode="time"
            clearable
            value={form.newStartTime ?? null}
            onChange={(newStartTime) => set({ newStartTime })}
            error={errors.newStartTime}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DateTimeField
            label={t('courses.end')}
            mode="time"
            clearable
            value={form.newEndTime ?? null}
            onChange={(newEndTime) => set({ newEndTime })}
            error={errors.newEndTime}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('courses.room')}
            value={form.newRoom ?? ''}
            onChangeText={(newRoom) => set({ newRoom })}
            error={errors.newRoom}
            limit={fieldLimits.room}
            placeholder={t('common.optional')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('courses.teacher')}
            value={form.newTeacher ?? ''}
            onChangeText={(newTeacher) => set({ newTeacher })}
            error={errors.newTeacher}
            limit={fieldLimits.teacher}
            placeholder={t('common.optional')}
          />
        </View>
      </View>
      <TextField
        label={t('courses.titleField')}
        value={form.newTitle ?? ''}
        onChangeText={(newTitle) => set({ newTitle })}
        error={errors.newTitle}
        limit={fieldLimits.title80}
        placeholder={t('common.optional')}
      />
      <TextField
        label={t('occurrence.note')}
        value={form.note ?? ''}
        onChangeText={(note) => set({ note })}
        error={errors.note}
        limit={fieldLimits.description500}
        placeholder={t('occurrence.notePlaceholder')}
        multiline
      />
    </FormScreen>
  );
}
