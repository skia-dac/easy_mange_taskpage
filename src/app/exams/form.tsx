import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { subjectOptions } from '@/components/SubjectOptions';
import { useSubjects } from '@/hooks/useSubjects';
import {
  createExam,
  deleteExam,
  examReminderOptions,
  getExam,
  listTimetables,
  updateExam,
  type ExamInput,
} from '@/modules/academic';
import { toIsoDate } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  ChoiceChips,
  confirmDestructive,
  DateTimeField,
  FormScreen,
  SelectField,
  showError,
  TextButton,
  TextField,
  useSave,
} from '@/shared/ui';

type Form = Omit<ExamInput, 'durationMinutes' | 'grade' | 'gradeMax' | 'coefficient'> & {
  duration: string;
  grade: string;
  gradeMax: string;
  coefficient: string;
};

export default function ExamFormScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { spacing } = useTheme();
  const params = useLocalSearchParams<{
    id?: string;
    subjectId?: string;
    date?: string;
    timetableId?: string;
  }>();
  const { subjects } = useSubjects();
  const timetables = useLiveQuery(listTimetables, ['timetables'], []);
  const examTimetables = (timetables.data ?? []).filter((tt) => tt.kind === 'exams');
  const [form, setForm] = useState<Form>({
    subjectId: params.subjectId ?? '',
    title: '',
    date: params.date ?? toIsoDate(new Date()),
    time: '09:00',
    duration: '',
    room: '',
    description: '',
    reminderDays: [7, 1],
    reminderTime: '09:00',
    grade: '',
    gradeMax: '20',
    coefficient: '1',
    timetableId: params.timetableId ?? null,
  });
  const { errors, saving, run } = useSave();
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!params.id) return;
    void getExam(db, params.id).then(
      (e) =>
        e &&
        setForm({
          ...e,
          duration: e.durationMinutes ? String(e.durationMinutes) : '',
          grade: e.grade === null ? '' : String(e.grade),
          gradeMax: String(e.gradeMax),
          coefficient: String(e.coefficient),
        }),
    );
  }, [db, params.id]);

  const toInput = (): ExamInput => {
    const { duration, grade, gradeMax, coefficient, ...rest } = form;
    const trimmed = duration.trim();
    // Texte non numérique → NaN : refusé par la validation avec un message clair.
    // Les notes acceptent la virgule (« 14,5 ») ; seuls les chiffres sont admis (pas « 1e3 »).
    const num = (v: string) => {
      const t = v.trim().replace(/,/g, '.');
      return /^\d+(\.\d+)?$/.test(t) ? Number(t) : Number.NaN;
    };
    return {
      ...rest,
      durationMinutes: trimmed === '' ? null : /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN,
      grade: grade.trim() === '' ? null : num(grade),
      gradeMax: gradeMax.trim() === '' ? 20 : num(gradeMax),
      coefficient: coefficient.trim() === '' ? 1 : num(coefficient),
    };
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
      {examTimetables.length > 0 ? (
        <SelectField
          label={t('exams.timetable')}
          value={form.timetableId ?? null}
          noneLabel={t('courses.noTimetable')}
          options={examTimetables.map((tt) => ({ value: tt.id, label: tt.name }))}
          onChange={(timetableId) => set({ timetableId })}
        />
      ) : null}
      <ChoiceChips
        label={t('reminder.examDays')}
        options={examReminderOptions.map((d) => ({
          value: d,
          label: t('reminder.daysBefore', { count: d }),
        }))}
        selected={form.reminderDays ?? []}
        onToggle={(d) =>
          set({
            reminderDays: (form.reminderDays ?? []).includes(d)
              ? (form.reminderDays ?? []).filter((x) => x !== d)
              : [...(form.reminderDays ?? []), d].sort((a, b) => b - a),
          })
        }
      />
      {(form.reminderDays ?? []).length > 0 ? (
        <DateTimeField
          label={t('reminder.examTime')}
          mode="time"
          required
          value={form.reminderTime ?? '09:00'}
          onChange={(v) => set({ reminderTime: v ?? '09:00' })}
          error={errors.reminderTime}
        />
      ) : null}
      <TextField
        label={t('exams.description')}
        value={form.description ?? ''}
        onChangeText={(description) => set({ description })}
        error={errors.description}
        placeholder={t('common.optional')}
        multiline
      />
      <AppText variant="heading">{t('grades.section')}</AppText>
      <AppText variant="caption" color="muted">
        {t('grades.sectionHint')}
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('grades.grade')}
            value={form.grade}
            onChangeText={(grade) => set({ grade })}
            error={errors.grade}
            placeholder="—"
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('grades.gradeMax')}
            value={form.gradeMax}
            onChangeText={(gradeMax) => set({ gradeMax })}
            error={errors.gradeMax}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('grades.coefficient')}
            value={form.coefficient}
            onChangeText={(coefficient) => set({ coefficient })}
            error={errors.coefficient}
            keyboardType="decimal-pad"
          />
        </View>
      </View>
    </FormScreen>
  );
}
