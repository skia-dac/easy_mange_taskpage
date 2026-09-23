import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { subjectOptions } from '@/components/SubjectOptions';
import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import { courseReminderOptions } from '@/modules/identity';
import {
  activeTimetable,
  courseInputSchema,
  courseTypes,
  createCourse,
  deleteCourse,
  getCourseSeries,
  listTimetables,
  occurrencesInRange,
  splitSeries,
  updateCourse,
  type CourseInput,
} from '@/modules/academic';
import { addDaysIso, isoWeekday, toIsoDate } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Card,
  ChoiceChips,
  confirmDestructive,
  DateTimeField,
  FormScreen,
  Segmented,
  SelectField,
  showError,
  TextButton,
  TextField,
  useSave,
} from '@/shared/ui';

type Form = Omit<CourseInput, 'weekday'> & { weekday: number };

export default function CourseFormScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { spacing } = useTheme();
  const params = useLocalSearchParams<{
    id?: string;
    subjectId?: string;
    timetableId?: string;
    date?: string;
    /** following : « ce cours et les suivants » à partir de `date` (§27 option 2) */
    scope?: string;
  }>();
  const following = params.scope === 'following' && !!params.date;
  const { subjects, byId } = useSubjects();
  const timetables = useLiveQuery(listTimetables, ['timetables'], []);
  const today = toIsoDate(new Date());
  const baseDay = params.date ?? today;

  const [form, setForm] = useState<Form>({
    subjectId: params.subjectId ?? '',
    timetableId: params.timetableId ?? null,
    title: '',
    teacher: '',
    room: '',
    courseType: 'lecture',
    recurrence: 'weekly',
    weekday: isoWeekday(baseDay),
    startDate: baseDay,
    endDate: addDaysIso(baseDay, 16 * 7),
    startTime: '08:00',
    endTime: '10:00',
    description: '',
    reminderMinutes: null,
  });
  const { errors, saving, run } = useSave();
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  // Modification : on charge le cours. Création : on part de l'emploi du temps choisi ou actif.
  useEffect(() => {
    let active = true;
    void (async () => {
      if (params.id) {
        const c = await getCourseSeries(db, params.id);
        if (active && c) setForm({ ...c, startDate: c.validFrom, endDate: c.validUntil });
        return;
      }
      const all = await listTimetables(db);
      const tt = all.find((x) => x.id === params.timetableId) ?? activeTimetable(all, baseDay);
      if (active && tt) {
        setForm((f) => ({
          ...f,
          timetableId: tt.id,
          startDate: tt.validFrom > baseDay ? tt.validFrom : baseDay,
          endDate: tt.validUntil,
        }));
      }
    })();
    return () => {
      active = false;
    };
  }, [db, params.id, params.timetableId, baseDay]);

  const chooseSubject = (subjectId: string | null) => {
    const s = subjectId ? byId.get(subjectId) : undefined;
    // Pré-remplit professeur et salle avec ceux de la matière s'ils sont vides.
    setForm((f) => ({
      ...f,
      subjectId: subjectId ?? '',
      teacher: f.teacher || s?.teacher || '',
      room: f.room || s?.room || '',
    }));
  };

  const chooseTimetable = (timetableId: string | null) => {
    const tt = timetables.data?.find((x) => x.id === timetableId);
    set(
      tt ? { timetableId, startDate: tt.validFrom, endDate: tt.validUntil } : { timetableId: null },
    );
  };

  // Aperçu : combien de séances seront créées (critère 6 : la période est respectée).
  const preview = useMemo(() => {
    const parsed = courseInputSchema.safeParse(form);
    if (!parsed.success || form.recurrence !== 'weekly') return null;
    const count = occurrencesInRange(
      [{ ...parsed.data, id: 'preview' }],
      parsed.data.validFrom,
      parsed.data.validUntil,
    ).length;
    return t('courses.countWeekly', {
      count,
      weekday: labels.weekday(parsed.data.weekday),
      start: parsed.data.startTime,
      end: parsed.data.endTime,
    });
  }, [form, labels, t]);

  const submit = () =>
    run(async () => {
      if (params.id && following) await splitSeries(db, params.id, params.date as string, form);
      else if (params.id) await updateCourse(db, params.id, form);
      else await createCourse(db, form);
      router.back();
    });

  const remove = async () => {
    if (!params.id) return;
    const ok = await confirmDestructive(
      t('courses.deleteTitle'),
      form.recurrence === 'weekly'
        ? t('courses.deleteSeries', { weekday: labels.weekday(form.weekday) })
        : t('courses.deleteOnce'),
      t('common.delete'),
    );
    if (!ok) return;
    try {
      await deleteCourse(db, params.id);
      // Revient à l'onglet d'où l'on vient (l'élément n'existe plus).
      router.dismissAll();
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  const weekly = form.recurrence === 'weekly';

  return (
    <FormScreen
      submitLabel={t('courses.save')}
      onSubmit={submit}
      saving={saving}
      footer={
        params.id ? (
          <TextButton label={t('courses.delete')} color="danger" onPress={() => void remove()} />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: params.id ? t('courses.edit') : t('courses.new') }} />
      {params.id && weekly ? (
        <AppText color="muted">
          {following
            ? t('occurrence.followingHint', {
                date: formatShortDate(params.date as string, labels.lang),
              })
            : t('courses.editSeriesHint')}
        </AppText>
      ) : null}
      <SelectField
        label={t('courses.subject')}
        required
        value={form.subjectId || null}
        options={subjectOptions(subjects)}
        onChange={chooseSubject}
        error={errors.subjectId}
        footer={{
          label: t('courses.createSubject'),
          onPress: () => router.push({ pathname: '/subjects/form', params: { from: 'picker' } }),
        }}
      />
      <ChoiceChips
        label={t('courses.type')}
        options={courseTypes.map((v) => ({ value: v, label: labels.courseType(v) }))}
        selected={[form.courseType]}
        onToggle={(courseType) => set({ courseType })}
      />
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" color="muted">
          {t('courses.recurrence')}
        </AppText>
        <Segmented
          value={form.recurrence}
          onChange={(recurrence) => set({ recurrence })}
          options={[
            { value: 'weekly', label: t('recurrence.weekly') },
            { value: 'none', label: t('recurrence.none') },
          ]}
        />
      </View>

      {weekly ? (
        <>
          <ChoiceChips
            label={t('courses.weekday')}
            options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({
              value: n,
              label: labels.weekday(n, 'short'),
            }))}
            selected={[form.weekday]}
            onToggle={(weekday) => set({ weekday })}
          />
          <SelectField
            label={t('courses.timetable')}
            value={form.timetableId ?? null}
            noneLabel={t('courses.noTimetable')}
            options={(timetables.data ?? []).map((tt) => ({ value: tt.id, label: tt.name }))}
            onChange={chooseTimetable}
            footer={{
              label: t('courses.createTimetable'),
              onPress: () => router.push('/timetables/form'),
            }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <DateTimeField
                label={t('courses.from')}
                mode="date"
                required
                value={form.startDate}
                onChange={(v) => set({ startDate: v ?? today })}
                error={errors.startDate}
              />
            </View>
            <View style={{ flex: 1 }}>
              <DateTimeField
                label={t('courses.until')}
                mode="date"
                required
                value={form.endDate ?? null}
                onChange={(v) => set({ endDate: v })}
                error={errors.endDate}
              />
            </View>
          </View>
        </>
      ) : (
        <DateTimeField
          label={t('courses.date')}
          mode="date"
          required
          value={form.startDate}
          onChange={(v) => set({ startDate: v ?? today })}
          error={errors.startDate}
        />
      )}

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <DateTimeField
            label={t('courses.start')}
            mode="time"
            required
            value={form.startTime}
            onChange={(v) => set({ startTime: v ?? '08:00' })}
            error={errors.startTime}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DateTimeField
            label={t('courses.end')}
            mode="time"
            required
            value={form.endTime}
            onChange={(v) => set({ endTime: v ?? '10:00' })}
            error={errors.endTime}
          />
        </View>
      </View>

      {preview ? (
        <Card>
          <AppText>{preview}</AppText>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('courses.room')}
            value={form.room ?? ''}
            onChangeText={(room) => set({ room })}
            error={errors.room}
            placeholder={t('common.optional')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('courses.teacher')}
            value={form.teacher ?? ''}
            onChangeText={(teacher) => set({ teacher })}
            error={errors.teacher}
            placeholder={t('common.optional')}
          />
        </View>
      </View>
      <ChoiceChips
        label={t('reminder.label')}
        options={[
          { value: null, label: t('reminder.default') },
          ...courseReminderOptions.map((m) => ({
            value: m as number | null,
            label: labels.reminderMinutes(m),
          })),
        ]}
        selected={[form.reminderMinutes ?? null]}
        onToggle={(reminderMinutes) => set({ reminderMinutes })}
      />
      <TextField
        label={t('courses.titleField')}
        value={form.title ?? ''}
        onChangeText={(title) => set({ title })}
        error={errors.title}
        placeholder={t('common.optional')}
      />
      <TextField
        label={t('courses.description')}
        value={form.description ?? ''}
        onChangeText={(description) => set({ description })}
        error={errors.description}
        placeholder={t('common.optional')}
        multiline
      />
    </FormScreen>
  );
}
