import { Stack, useLocalSearchParams } from 'expo-router';

import { goBack, backToList } from '@/components/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ReminderField } from '@/components/ReminderField';
import { subjectOptions } from '@/components/SubjectOptions';
import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import { useDirty, useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import {
  createWorkItem,
  deleteWorkItem,
  estimatePresets,
  getWorkItem,
  priorities,
  repeatRules,
  shiftReminder,
  updateWorkItem,
  workStatuses,
  type WorkItemInput,
  type WorkKind,
} from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { useSpaces } from '@/shared/SpacesContext';
import {
  AppText,
  ChoiceChips,
  confirmDestructive,
  DateTimeField,
  Disclosure,
  FormScreen,
  SelectField,
  showError,
  TextButton,
  TextField,
  fieldLimits,
  useSave,
  reportLoadError,
} from '@/shared/ui';

/** Champs de « Plus d'options » déjà remplis : la section s'ouvre seule à la modification. */
function hasMoreOptions(f: WorkItemInput): boolean {
  return (
    !!f.dueTime ||
    !!f.reminderAt ||
    !!f.estimatedMinutes ||
    f.priority !== 'normal' ||
    (f.repeat ?? 'none') !== 'none' ||
    !!f.description?.trim()
  );
}

/**
 * Formulaire commun aux tâches et aux devoirs (`kind`). Court : titre, matière (Études), date ;
 * le reste derrière « Plus d'options ». Le statut n'existe qu'à la modification.
 */
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
  const spaces = useSpaces();
  const study = spaces.has('study');
  const editing = !!params.id;
  // Le type enregistré (tâche ou devoir) ne change jamais à la modification.
  const savedKind: WorkKind = params.kind === 'task' ? 'task' : 'assignment';
  const { subjects } = useSubjects();
  const [form, setForm] = useState<WorkItemInput>({
    title: '',
    description: '',
    subjectId: study ? (params.subjectId ?? null) : null,
    dueDate: params.date ?? toIsoDate(new Date()),
    dueTime: null,
    priority: 'normal',
    status: 'todo',
    reminderAt: null,
    repeat: 'none',
    estimatedMinutes: null,
  });
  // Une seule fiche : un devoir est une tâche avec une matière (Études). À la création, la matière
  // choisit la table ; à la modification, l'élément reste dans sa table (même id, une seule
  // modification à synchroniser) et la matière peut être ajoutée ou retirée.
  const withSubject = study && !!form.subjectId;
  const kind: WorkKind = editing ? savedKind : withSubject ? 'assignment' : 'task';
  // Libellés : comme le reste de l'app (détail, listes), ceux de la table à la modification.
  const isTask = kind === 'task';
  const { errors, saving, run } = useSave();
  const set = (patch: Partial<WorkItemInput>) => setForm((f) => ({ ...f, ...patch }));
  const { dirty, markClean } = useDirty(form);
  const leave = useUnsavedGuard(dirty);
  // null : pas encore touché ; ouvert d'office si la tâche modifiée a déjà ces champs.
  const [moreOpen, setMoreOpen] = useState<boolean | null>(null);
  const showMore =
    (moreOpen ?? (editing && hasMoreOptions(form))) ||
    !!(errors.dueTime || errors.reminderAt || errors.description);

  useEffect(() => {
    if (!params.id) return;
    void getWorkItem(db, savedKind, params.id)
      .then((w) => {
        if (!w) return;
        setForm(w);
        markClean(w);
      })
      .catch(reportLoadError);
  }, [db, savedKind, params.id, markClean]);

  const submit = () =>
    run(async () => {
      if (params.id) await updateWorkItem(db, kind, params.id, form);
      else await createWorkItem(db, kind, form);
      leave(goBack);
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
      leave(backToList);
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  const title = editing
    ? isTask
      ? t('work.editTask')
      : t('work.editAssignment')
    : t('work.newTask');

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
        limit={fieldLimits.title120}
        placeholder={isTask ? t('work.titlePlaceholderTask') : t('work.titlePlaceholderAssignment')}
        autoFocus={!params.id}
      />
      {/* La matière appartient à Études : sans Études, le champ n'existe pas. Avec Études, on peut
          toujours choisir « Aucune », à la création comme à la modification. */}
      {study ? (
        <>
          <SelectField
            label={t('work.subjectOptional')}
            value={form.subjectId ?? null}
            noneLabel={t('work.noSubject')}
            options={subjectOptions(subjects)}
            onChange={(subjectId) => set({ subjectId })}
          />
          {!editing ? (
            <AppText variant="caption" color="muted">
              {t('work.subjectMakesAssignment')}
            </AppText>
          ) : null}
        </>
      ) : null}
      <DateTimeField
        label={isTask ? t('work.dueDate') : t('work.dueDateAssignment')}
        mode="date"
        required
        value={form.dueDate}
        onChange={(v) => {
          const dueDate = v ?? toIsoDate(new Date());
          // Le rappel suit l'échéance (« la veille à 18:00 » reste la veille).
          setForm((f) => ({
            ...f,
            dueDate,
            reminderAt: shiftReminder(f.reminderAt, f.dueDate, dueDate),
          }));
        }}
        error={errors.dueDate}
      />
      {editing ? (
        <ChoiceChips
          label={t('work.status')}
          options={workStatuses.map((s) => ({ value: s, label: labels.status(s) }))}
          selected={[form.status]}
          onToggle={(status) => set({ status })}
        />
      ) : null}
      <Disclosure
        label={t('work.moreOptions')}
        hint={t('work.moreOptionsHint')}
        open={showMore}
        onToggle={setMoreOpen}
      >
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
        <TextField
          label={t('work.description')}
          value={form.description ?? ''}
          onChangeText={(description) => set({ description })}
          error={errors.description}
          limit={fieldLimits.description2000}
          placeholder={t('common.optional')}
          multiline
        />
      </Disclosure>
    </FormScreen>
  );
}
