import { Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/components/navigation';
import { EditLoadView } from '@/components/EditLoadView';
import { useEditLoad } from '@/hooks/useEditLoad';
import { useDirty, useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  countAffectedOccurrences,
  createOffPeriod,
  deleteOffPeriod,
  getOffPeriod,
  listCourseExceptions,
  listCourseSeries,
  listOffPeriods,
  offPeriodKinds,
  updateOffPeriod,
  type OffPeriodInput,
} from '@/modules/academic';
import { toIsoDate } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Card,
  confirmDestructive,
  DateTimeField,
  FormScreen,
  Segmented,
  showError,
  TextButton,
  TextField,
  fieldLimits,
  useSave,
  Toggle,
} from '@/shared/ui';

export default function OffPeriodFormScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { spacing } = useTheme();
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();
  const today = date ?? toIsoDate(new Date());
  const [form, setForm] = useState<OffPeriodInput>({
    name: '',
    kind: 'holiday',
    startDate: today,
    endDate: today,
    suspendCourses: true,
  });
  const { errors, saving, run } = useSave();
  const set = (patch: Partial<OffPeriodInput>) => setForm((f) => ({ ...f, ...patch }));
  const series = useLiveQuery((d) => listCourseSeries(d), ['course_series'], []);
  const exceptions = useLiveQuery((d) => listCourseExceptions(d), ['course_exceptions'], []);
  const offPeriods = useLiveQuery((d) => listOffPeriods(d), ['off_periods'], []);
  // Séances qui disparaîtraient : sans celles déjà annulées ni celles masquées par une autre période
  // (la période en cours de modification est exclue, sinon elle masquerait ses propres séances).
  const affected =
    form.endDate >= form.startDate
      ? countAffectedOccurrences(series.data ?? [], form.startDate, form.endDate, {
          exceptions: exceptions.data ?? [],
          offPeriods: (offPeriods.data ?? []).filter((p) => p.id !== id),
        })
      : 0;

  // Modification : les champs n'apparaissent qu'une fois la période lue (jamais écrasés).
  const load = useEditLoad(id, (periodId) => getOffPeriod(db, periodId), setForm);
  const { dirty } = useDirty(form, load.state === 'ready');
  const leave = useUnsavedGuard(dirty);

  const submit = () =>
    run(async () => {
      if (id) await updateOffPeriod(db, id, form);
      else await createOffPeriod(db, form);
      leave(goBack);
    });

  const remove = async () => {
    if (!id) return;
    const ok = await confirmDestructive(
      t('offPeriods.deleteTitle', { name: form.name }),
      t('offPeriods.deleteMessage'),
      t('common.delete'),
    );
    if (!ok) return;
    try {
      await deleteOffPeriod(db, id);
      leave(goBack);
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  const single = form.kind === 'day_off';

  if (load.state !== 'ready')
    return <EditLoadView state={load.state} onRetry={load.retry} title={t('offPeriods.edit')} />;

  return (
    <FormScreen
      submitLabel={t('offPeriods.save')}
      onSubmit={submit}
      saving={saving}
      footer={
        id ? (
          <TextButton label={t('offPeriods.delete')} color="danger" onPress={() => void remove()} />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: id ? t('offPeriods.edit') : t('offPeriods.new') }} />
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" color="muted">
          {t('offPeriods.kind')}
        </AppText>
        <Segmented
          accessibilityLabel={t('offPeriods.kind')}
          value={form.kind}
          onChange={(kind) =>
            set(kind === 'day_off' ? { kind, endDate: form.startDate } : { kind })
          }
          options={offPeriodKinds.map((k) => ({ value: k, label: t(`offPeriods.${k}`) }))}
        />
      </View>
      <TextField
        label={t('offPeriods.name')}
        required
        value={form.name}
        onChangeText={(name) => set({ name })}
        error={errors.name}
        limit={fieldLimits.name60}
        placeholder={t('offPeriods.namePlaceholder')}
        autoFocus={!id}
      />
      {single ? (
        <DateTimeField
          label={t('offPeriods.date')}
          mode="date"
          required
          value={form.startDate}
          onChange={(v) => set({ startDate: v ?? today, endDate: v ?? today })}
          error={errors.startDate}
        />
      ) : (
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <DateTimeField
              label={t('offPeriods.from')}
              mode="date"
              required
              value={form.startDate}
              onChange={(v) => set({ startDate: v ?? today })}
              error={errors.startDate}
            />
          </View>
          <View style={{ flex: 1 }}>
            <DateTimeField
              label={t('offPeriods.until')}
              mode="date"
              required
              value={form.endDate}
              onChange={(v) => set({ endDate: v ?? today })}
              error={errors.endDate}
            />
          </View>
        </View>
      )}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="bodyStrong">{t('offPeriods.suspend')}</AppText>
            {form.suspendCourses ? (
              <AppText variant="caption" color="muted">
                {affected > 0
                  ? t('offPeriods.suspendHint', { count: affected })
                  : t('offPeriods.suspendNone')}
              </AppText>
            ) : null}
          </View>
          <Toggle
            accessibilityLabel={t('offPeriods.suspend')}
            value={form.suspendCourses}
            onValueChange={(suspendCourses) => set({ suspendCourses })}
          />
        </View>
      </Card>
    </FormScreen>
  );
}
