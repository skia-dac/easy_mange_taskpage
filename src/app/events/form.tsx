import { Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/components/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ReminderField } from '@/components/ReminderField';
import { SpacePicker } from '@/components/SpaceUi';
import {
  createPersonalEvent,
  deletePersonalEvent,
  getPersonalEvent,
  updatePersonalEvent,
  type PersonalEventInput,
} from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { useSpaces } from '@/shared/SpacesContext';
import { defaultSpace, spaceIds, type SpaceId } from '@/shared/spaces';
import { useTheme } from '@/shared/theme';
import {
  confirmDestructive,
  DateTimeField,
  FormScreen,
  showError,
  TextButton,
  TextField,
  useSave,
  reportLoadError,
} from '@/shared/ui';

export default function EventFormScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { spacing } = useTheme();
  const params = useLocalSearchParams<{ id?: string; date?: string; space?: string }>();
  const spaces = useSpaces();
  const [form, setForm] = useState<PersonalEventInput>({
    title: '',
    date: params.date ?? toIsoDate(new Date()),
    startTime: null,
    endTime: null,
    description: '',
    reminderAt: null,
    space: spaceIds.includes(params.space as SpaceId)
      ? (params.space as SpaceId)
      : defaultSpace(spaces.active),
  });
  const { errors, saving, run } = useSave();
  const set = (patch: Partial<PersonalEventInput>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!params.id) return;
    void getPersonalEvent(db, params.id)
      .then((e) => e && setForm(e))
      .catch(reportLoadError);
  }, [db, params.id]);

  const submit = () =>
    run(async () => {
      if (params.id) await updatePersonalEvent(db, params.id, form);
      else await createPersonalEvent(db, form);
      goBack();
    });

  const remove = async () => {
    if (!params.id) return;
    const ok = await confirmDestructive(
      t('events.deleteTitle'),
      t('events.deleteMessage'),
      t('common.delete'),
    );
    if (!ok) return;
    try {
      await deletePersonalEvent(db, params.id);
      goBack();
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  return (
    <FormScreen
      submitLabel={t('events.save')}
      onSubmit={submit}
      saving={saving}
      footer={
        params.id ? (
          <TextButton label={t('events.delete')} color="danger" onPress={() => void remove()} />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: params.id ? t('events.edit') : t('events.new') }} />
      <TextField
        label={t('events.title')}
        required
        value={form.title}
        onChangeText={(title) => set({ title })}
        error={errors.title}
        placeholder={t('events.titlePlaceholder')}
        autoFocus={!params.id}
      />
      <SpacePicker
        value={form.space ?? defaultSpace(spaces.active)}
        onChange={(space) => set({ space })}
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
            label={t('events.start')}
            mode="time"
            clearable
            value={form.startTime ?? null}
            onChange={(startTime) => set({ startTime })}
            error={errors.startTime}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DateTimeField
            label={t('events.end')}
            mode="time"
            clearable
            value={form.endTime ?? null}
            onChange={(endTime) => set({ endTime })}
            error={errors.endTime}
          />
        </View>
      </View>
      <ReminderField
        dueDate={form.date}
        value={form.reminderAt ?? null}
        onChange={(reminderAt) => set({ reminderAt })}
        error={errors.reminderAt}
      />
      <TextField
        label={t('events.description')}
        value={form.description ?? ''}
        onChangeText={(description) => set({ description })}
        error={errors.description}
        placeholder={t('common.optional')}
        multiline
      />
    </FormScreen>
  );
}
