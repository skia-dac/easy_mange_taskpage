import { Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/components/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  createTimetable,
  getTimetable,
  listCourseSeries,
  timetableKinds,
  updateTimetable,
  type TimetableInput,
  type TimetableKind,
} from '@/modules/academic';
import { addDaysIso, toIsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import {
  confirmDestructive,
  DateTimeField,
  FormScreen,
  Segmented,
  showError,
  TextButton,
  TextField,
  fieldLimits,
  useSave,
  reportLoadError,
} from '@/shared/ui';
import { deleteTimetableEverywhere } from '@/workflows';

export default function TimetableFormScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { id, kind } = useLocalSearchParams<{ id?: string; kind?: TimetableKind }>();
  const today = toIsoDate(new Date());
  const [form, setForm] = useState<TimetableInput>({
    name: '',
    validFrom: today,
    validUntil: addDaysIso(today, 120),
    kind: kind && timetableKinds.includes(kind) ? kind : 'courses',
  });
  const { errors, saving, run } = useSave();

  useEffect(() => {
    if (!id) return;
    void getTimetable(db, id)
      .then((tt) => tt && setForm(tt))
      .catch(reportLoadError);
  }, [db, id]);

  const set = (patch: Partial<TimetableInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = () =>
    run(async () => {
      if (id) await updateTimetable(db, id, form);
      else await createTimetable(db, form);
      goBack();
    });

  const remove = async () => {
    if (!id) return;
    const count = (await listCourseSeries(db, { timetableId: id })).length;
    const ok = await confirmDestructive(
      t('timetables.deleteTitle', { name: form.name }),
      form.kind === 'courses' || count > 0
        ? t('timetables.deleteMessage', { count })
        : t('timetables.deleteKeepMessage'),
      t('common.delete'),
    );
    if (!ok) return;
    try {
      await deleteTimetableEverywhere(db, id);
      goBack();
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  return (
    <FormScreen
      submitLabel={t('timetables.save')}
      onSubmit={submit}
      saving={saving}
      footer={
        id ? (
          <TextButton label={t('timetables.delete')} color="danger" onPress={() => void remove()} />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: id ? t('timetables.edit') : t('timetables.new') }} />
      <TextField
        label={t('timetables.name')}
        required
        value={form.name}
        onChangeText={(name) => set({ name })}
        error={errors.name}
        limit={fieldLimits.name60}
        placeholder={t('timetables.namePlaceholder')}
        autoFocus={!id}
      />
      <Segmented
        accessibilityLabel={t('timetables.kind')}
        options={timetableKinds.map((k) => ({ value: k, label: t(`timetables.kinds.${k}`) }))}
        value={form.kind ?? 'courses'}
        onChange={(k) => set({ kind: k })}
      />
      <DateTimeField
        label={t('timetables.from')}
        mode="date"
        required
        value={form.validFrom}
        onChange={(v) => set({ validFrom: v ?? today })}
        error={errors.validFrom}
      />
      <DateTimeField
        label={t('timetables.until')}
        mode="date"
        required
        value={form.validUntil}
        onChange={(v) => set({ validUntil: v ?? today })}
        error={errors.validUntil}
      />
    </FormScreen>
  );
}
