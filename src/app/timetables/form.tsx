import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  createTimetable,
  deleteTimetable,
  getTimetable,
  listCourseSeries,
  updateTimetable,
  type TimetableInput,
} from '@/modules/academic';
import { addDaysIso, toIsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import {
  confirmDestructive,
  DateTimeField,
  FormScreen,
  showError,
  TextButton,
  TextField,
  useSave,
} from '@/shared/ui';

export default function TimetableFormScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const today = toIsoDate(new Date());
  const [form, setForm] = useState<TimetableInput>({
    name: '',
    validFrom: today,
    validUntil: addDaysIso(today, 120),
  });
  const { errors, saving, run } = useSave();

  useEffect(() => {
    if (!id) return;
    void getTimetable(db, id).then((tt) => tt && setForm(tt));
  }, [db, id]);

  const set = (patch: Partial<TimetableInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = () =>
    run(async () => {
      if (id) await updateTimetable(db, id, form);
      else await createTimetable(db, form);
      router.back();
    });

  const remove = async () => {
    if (!id) return;
    const count = (await listCourseSeries(db, { timetableId: id })).length;
    const ok = await confirmDestructive(
      t('timetables.deleteTitle', { name: form.name }),
      t('timetables.deleteMessage', { count }),
      t('common.delete'),
    );
    if (!ok) return;
    try {
      await deleteTimetable(db, id);
      router.back();
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
        placeholder={t('timetables.namePlaceholder')}
        autoFocus={!id}
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
