import { Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/components/navigation';
import { EditLoadView } from '@/components/EditLoadView';
import { useEditLoad } from '@/hooks/useEditLoad';
import { useDirty, useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { subjectOptions } from '@/components/SubjectOptions';
import { useSubjects } from '@/hooks/useSubjects';
import {
  createRevisionBlock,
  getRevisionBlock,
  updateRevisionBlock,
  type RevisionBlockInput,
} from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { useTheme } from '@/shared/theme';
import {
  DateTimeField,
  FormScreen,
  SelectField,
  TextField,
  fieldLimits,
  useSave,
} from '@/shared/ui';

/** Ajouter ou modifier une séance de révision à la main. */
export default function RevisionFormScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { spacing } = useTheme();
  const { subjects } = useSubjects();
  const params = useLocalSearchParams<{
    id?: string;
    date?: string;
    start?: string;
    subjectId?: string;
  }>();
  const [form, setForm] = useState<RevisionBlockInput>({
    subjectId: params.subjectId ?? null,
    examId: null,
    timetableId: null,
    date: params.date ?? toIsoDate(new Date()),
    startTime: params.start ?? '18:00',
    endTime: '19:00',
    title: '',
  });
  const { errors, saving, run } = useSave();
  const set = (patch: Partial<RevisionBlockInput>) => setForm((f) => ({ ...f, ...patch }));

  // Modification : les champs n'apparaissent qu'une fois la séance lue (jamais écrasés).
  const load = useEditLoad(params.id, (id) => getRevisionBlock(db, id), setForm);
  const { dirty } = useDirty(form, load.state === 'ready');
  const leave = useUnsavedGuard(dirty);

  const submit = () =>
    run(async () => {
      if (params.id) await updateRevisionBlock(db, params.id, form);
      else await createRevisionBlock(db, form);
      leave(goBack);
    });

  if (load.state !== 'ready')
    return <EditLoadView state={load.state} onRetry={load.retry} title={t('revision.edit')} />;

  return (
    <FormScreen submitLabel={t('revision.save')} onSubmit={submit} saving={saving}>
      <Stack.Screen options={{ title: params.id ? t('revision.edit') : t('revision.new') }} />
      <SelectField
        label={t('study.subject')}
        value={form.subjectId ?? null}
        noneLabel={t('work.noSubject')}
        options={subjectOptions(subjects)}
        onChange={(subjectId) => set({ subjectId })}
      />
      <TextField
        label={t('revision.titleLabel')}
        value={form.title ?? ''}
        onChangeText={(title) => set({ title })}
        error={errors.title}
        limit={fieldLimits.title80}
        placeholder={t('revision.titlePlaceholder')}
      />
      <DateTimeField
        label={t('events.date')}
        mode="date"
        required
        value={form.date}
        onChange={(v) => set({ date: v ?? toIsoDate(new Date()) })}
        error={errors.date}
      />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <DateTimeField
            label={t('courses.start')}
            mode="time"
            required
            value={form.startTime}
            onChange={(v) => v && set({ startTime: v })}
            error={errors.startTime}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DateTimeField
            label={t('courses.end')}
            mode="time"
            required
            value={form.endTime}
            onChange={(v) => v && set({ endTime: v })}
            error={errors.endTime}
          />
        </View>
      </View>
    </FormScreen>
  );
}
