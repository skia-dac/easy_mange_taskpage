import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ReminderField } from '@/components/ReminderField';
import { subjectOptions } from '@/components/SubjectOptions';
import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import {
  createWorkItem,
  deleteWorkItem,
  estimatePresets,
  getWorkItem,
  priorities,
  repeatRules,
  updateWorkItem,
  workStatuses,
  type WorkItemInput,
  type WorkKind,
} from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
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

/** Formulaire commun aux tâches et aux devoirs (`kind`). */
export default function WorkFormScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const params = useLocalSearchParams<{
    kind?: string;
    id?: string;
    subjectId?: string;
    date?: string;
    fromCourse?: string;
  }>();
  const kind: WorkKind = params.kind === 'task' ? 'task' : 'assignment';
  const isTask = kind === 'task';
  const { subjects } = useSubjects();
  const [form, setForm] = useState<WorkItemInput>({
    title: '',
    description: '',
    subjectId: params.subjectId ?? null,
    dueDate: params.date ?? toIsoDate(new Date()),
    dueTime: null,
    priority: 'normal',
    status: 'todo',
    reminderAt: null,
    repeat: 'none',
    estimatedMinutes: null,
  });
  const { errors, saving, run } = useSave();
  const set = (patch: Partial<WorkItemInput>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!params.id) return;
    void getWorkItem(db, kind, params.id).then((w) => w && setForm(w));
  }, [db, kind, params.id]);

  const submit = () =>
    run(async () => {
      if (params.id) await updateWorkItem(db, kind, params.id, form);
      else await createWorkItem(db, kind, form);
      router.back();
    });

  const remove = async () => {
    if (!params.id) return;
    const ok = await confirmDestructive(
      t('work.deleteTitle', { title: form.title }),
      t('work.deleteMessage'),
      t('common.delete'),
    );
    if (!ok) return;
    try {
      await deleteWorkItem(db, kind, params.id);
      // Revient à l'onglet d'où l'on vient (l'élément n'existe plus).
      router.dismissAll();
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  const title = params.id
    ? isTask
      ? t('work.editTask')
      : t('work.editAssignment')
    : isTask
      ? t('work.newTask')
      : t('work.newAssignment');

  return (
    <FormScreen
      submitLabel={isTask ? t('work.saveTask') : t('work.saveAssignment')}
      onSubmit={submit}
      saving={saving}
      footer={
        params.id ? (
          <TextButton
            label={isTask ? t('work.deleteTask') : t('work.deleteAssignment')}
            color="danger"
            onPress={() => void remove()}
          />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title }} />
      {params.fromCourse ? <AppText color="muted">{t('work.prefilled')}</AppText> : null}
      <TextField
        label={t('work.title')}
        required
        value={form.title}
        onChangeText={(v) => set({ title: v })}
        error={errors.title}
        placeholder={isTask ? t('work.titlePlaceholderTask') : t('work.titlePlaceholderAssignment')}
        autoFocus={!params.id}
      />
      <SelectField
        label={t('work.subjectOptional')}
        value={form.subjectId ?? null}
        noneLabel={t('work.noSubject')}
        options={subjectOptions(subjects)}
        onChange={(subjectId) => set({ subjectId })}
      />
      <DateTimeField
        label={isTask ? t('work.dueDate') : t('work.dueDateAssignment')}
        mode="date"
        required
        value={form.dueDate}
        onChange={(v) => set({ dueDate: v ?? toIsoDate(new Date()) })}
        error={errors.dueDate}
      />
      <DateTimeField
        label={isTask ? t('work.dueTime') : t('work.dueTimeAssignment')}
        mode="time"
        clearable
        value={form.dueTime ?? null}
        onChange={(dueTime) => set({ dueTime })}
        error={errors.dueTime}
      />
      <ReminderField
        dueDate={form.dueDate}
        value={form.reminderAt ?? null}
        onChange={(reminderAt) => set({ reminderAt })}
        error={errors.reminderAt}
      />
      <ChoiceChips
        label={t('work.estimate')}
        options={[
          { value: 0, label: t('work.noEstimate') },
          ...estimatePresets.map((m) => ({ value: m, label: labels.duration(m) })),
        ]}
        selected={[form.estimatedMinutes ?? 0]}
        onToggle={(m) => set({ estimatedMinutes: m === 0 ? null : m })}
      />
      <ChoiceChips
        label={t('work.priority')}
        options={priorities.map((p) => ({ value: p, label: labels.priority(p) }))}
        selected={[form.priority]}
        onToggle={(priority) => set({ priority })}
      />
      <ChoiceChips
        label={t('work.repeat')}
        options={repeatRules.map((r) => ({ value: r, label: t(`repeat.${r}`) }))}
        selected={[form.repeat ?? 'none']}
        onToggle={(repeat) => set({ repeat })}
      />
      <ChoiceChips
        label={t('work.status')}
        options={workStatuses.map((s) => ({ value: s, label: labels.status(s) }))}
        selected={[form.status]}
        onToggle={(status) => set({ status })}
      />
      <TextField
        label={t('work.description')}
        value={form.description ?? ''}
        onChangeText={(description) => set({ description })}
        error={errors.description}
        placeholder={t('common.optional')}
        multiline
      />
    </FormScreen>
  );
}
