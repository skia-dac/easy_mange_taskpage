import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { subjectOptions } from '@/components/SubjectOptions';
import { useSubjects } from '@/hooks/useSubjects';
import { createExam, deleteExam, getExam, updateExam, type ExamInput } from '@/modules/academic';
import { toIsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { useTheme } from '@/shared/theme';
import {
  confirmDestructive,
  DateTimeField,
  FormScreen,
  SelectField,
  showError,
  TextButton,
  TextField,
  useSave,
} from '@/shared/ui';

type Form = Omit<ExamInput, 'durationMinutes'> & { duration: string };

export default function ExamFormScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { spacing } = useTheme();
  const params = useLocalSearchParams<{ id?: string; subjectId?: string; date?: string }>();
  const { subjects } = useSubjects();
  const [form, setForm] = useState<Form>({
    subjectId: params.subjectId ?? '',
    title: '',
    date: params.date ?? toIsoDate(new Date()),
    time: '09:00',
    duration: '',
    room: '',
    description: '',
  });
  const { errors, saving, run } = useSave();
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!params.id) return;
    void getExam(db, params.id).then(
      (e) => e && setForm({ ...e, duration: e.durationMinutes ? String(e.durationMinutes) : '' }),
    );
  }, [db, params.id]);

  const toInput = (): ExamInput => {
    const { duration, ...rest } = form;
    const trimmed = duration.trim();
    // Texte non numérique → NaN : refusé par la validation avec un message clair.
    return { ...rest, durationMinutes: trimmed === '' ? null : Number(trimmed) };
  };

  const submit = () =>
    run(async () => {
      if (params.id) {
        await updateExam(db, params.id, toInput());
        router.back();
      } else {
        const id = await createExam(db, toInput());
        router.replace({ pathname: '/exams/[id]', params: { id } });
      }
    });

  const remove = async () => {
    if (!params.id) return;
    const ok = await confirmDestructive(
      t('exams.deleteTitle'),
      t('exams.deleteMessage'),
      t('common.delete'),
    );
    if (!ok) return;
    try {
      await deleteExam(db, params.id);
      // Revient à l'onglet d'où l'on vient (l'élément n'existe plus).
      router.dismissAll();
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  return (
    <FormScreen
      submitLabel={t('exams.save')}
      onSubmit={submit}
      saving={saving}
      footer={
        params.id ? (
          <TextButton label={t('exams.delete')} color="danger" onPress={() => void remove()} />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: params.id ? t('exams.edit') : t('exams.new') }} />
      <SelectField
        label={t('exams.subject')}
        required
        value={form.subjectId || null}
        options={subjectOptions(subjects)}
        onChange={(subjectId) => set({ subjectId: subjectId ?? '' })}
        error={errors.subjectId}
        footer={{
          label: t('courses.createSubject'),
          onPress: () => router.push({ pathname: '/subjects/form', params: { from: 'picker' } }),
        }}
      />
      <TextField
        label={t('exams.titleField')}
        value={form.title ?? ''}
        onChangeText={(title) => set({ title })}
        error={errors.title}
        placeholder={t('exams.titlePlaceholder')}
      />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <DateTimeField
            label={t('exams.date')}
            mode="date"
            required
            value={form.date}
            onChange={(v) => set({ date: v ?? toIsoDate(new Date()) })}
            error={errors.date}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DateTimeField
            label={t('exams.time')}
            mode="time"
            clearable
            value={form.time ?? null}
            onChange={(time) => set({ time })}
            error={errors.time}
          />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('exams.duration')}
            value={form.duration}
            onChangeText={(duration) => set({ duration })}
            error={errors.durationMinutes}
            keyboardType="number-pad"
            placeholder="120"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('exams.room')}
            value={form.room ?? ''}
            onChangeText={(room) => set({ room })}
            error={errors.room}
            placeholder={t('common.optional')}
          />
        </View>
      </View>
      <TextField
        label={t('exams.description')}
        value={form.description ?? ''}
        onChangeText={(description) => set({ description })}
        error={errors.description}
        placeholder={t('common.optional')}
        multiline
      />
    </FormScreen>
  );
}
