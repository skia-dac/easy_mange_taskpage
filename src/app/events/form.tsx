import { Stack, useLocalSearchParams } from 'expo-router';

import { EditLoadView } from '@/components/EditLoadView';
import { goBack } from '@/components/navigation';
import { useEditLoad } from '@/hooks/useEditLoad';
import { askNotificationPermission } from '@/hooks/useNotificationPermission';
import { useDirty, useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ReminderField } from '@/components/ReminderField';
import {
  createPersonalEvent,
  deletePersonalEvent,
  getPersonalEvent,
  shiftReminder,
  updatePersonalEvent,
  type PersonalEventInput,
} from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { useTheme } from '@/shared/theme';
import {
  confirmDestructive,
  DateTimeField,
  FormScreen,
  showError,
  TextButton,
  TextField,
  fieldLimits,
  useSave,
} from '@/shared/ui';

export default function EventFormScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { spacing } = useTheme();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const [form, setForm] = useState<PersonalEventInput>({
    title: '',
    date: params.date ?? toIsoDate(new Date()),
    startTime: null,
    endTime: null,
    description: '',
    reminderAt: null,
  });
  const { errors, saving, run } = useSave();
  const set = (patch: Partial<PersonalEventInput>) => setForm((f) => ({ ...f, ...patch }));

  // Modification : les champs n'apparaissent qu'une fois l'événement lu (jamais écrasés).
  const load = useEditLoad(params.id, (id) => getPersonalEvent(db, id), setForm);
  const { dirty } = useDirty(form, load.state === 'ready');
  const leave = useUnsavedGuard(dirty);

  const submit = () =>
    run(async () => {
      if (params.id) await updatePersonalEvent(db, params.id, form);
      else await createPersonalEvent(db, form);
      leave(goBack);
      // Rappel enregistré (le choix est fini) : sans permission, il ne sonnerait jamais.
      if (form.reminderAt) void askNotificationPermission(db);
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
      leave(goBack);
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  if (load.state !== 'ready')
    return <EditLoadView state={load.state} onRetry={load.retry} title={t('events.edit')} />;

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
        limit={fieldLimits.title120}
        placeholder={t('events.titlePlaceholder')}
        autoFocus={!params.id}
      />
      <DateTimeField
        label={t('events.date')}
        mode="date"
        required
        value={form.date}
        onChange={(v) => {
          const date = v ?? toIsoDate(new Date());
          // Le rappel suit la date de l'événement.
          setForm((f) => ({ ...f, date, reminderAt: shiftReminder(f.reminderAt, f.date, date) }));
        }}
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
        kind="event"
      />
      <TextField
        label={t('events.description')}
        value={form.description ?? ''}
        onChangeText={(description) => set({ description })}
        error={errors.description}
        limit={fieldLimits.description1000}
        placeholder={t('common.optional')}
        multiline
      />
    </FormScreen>
  );
}
