import Feather from '@expo/vector-icons/Feather';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Switch, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import {
  createHabit,
  deleteHabit,
  getHabit,
  habitFrequencies,
  habitIcons,
  updateHabit,
  type HabitInput,
} from '@/modules/productivity';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { minTouchSize, subjectColors, useTheme } from '@/shared/theme';
import {
  AppText,
  ChoiceChips,
  confirmDestructive,
  DateTimeField,
  FieldShell,
  FormScreen,
  Segmented,
  showError,
  TextButton,
  TextField,
  useSave,
} from '@/shared/ui';

type Form = Omit<HabitInput, 'target'> & { target: string };

/** Créer ou modifier une habitude. */
export default function HabitFormScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { colors, radius, spacing, scheme } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const [form, setForm] = useState<Form>({
    name: '',
    icon: 'check-circle',
    colorId: 'blue',
    frequency: 'daily',
    weekdays: [1, 2, 3, 4, 5],
    timesPerWeek: 3,
    target: '1',
    unit: '',
    reminderTime: null,
    autoStudy: false,
  });
  const { errors, saving, run } = useSave();
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!params.id) return;
    void getHabit(db, params.id).then(
      (h) =>
        h &&
        setForm({
          ...h,
          weekdays: h.weekdays.length > 0 ? h.weekdays : [1, 2, 3, 4, 5],
          target: String(h.target),
          unit: h.unit ?? '',
        }),
    );
  }, [db, params.id]);

  const toInput = (): HabitInput => {
    const n = Number(form.target.trim() || '1');
    return { ...form, target: n };
  };

  const submit = () =>
    run(async () => {
      if (params.id) {
        await updateHabit(db, params.id, toInput());
        router.back();
      } else {
        const id = await createHabit(db, toInput());
        router.replace({ pathname: '/habits/[id]', params: { id } });
      }
    });

  const remove = async () => {
    if (!params.id) return;
    const ok = await confirmDestructive(
      t('habits.deleteTitle', { name: form.name }),
      t('habits.deleteMessage'),
      t('common.delete'),
    );
    if (!ok) return;
    try {
      await deleteHabit(db, params.id);
      router.dismissTo('/habits');
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  return (
    <FormScreen
      submitLabel={t('habits.save')}
      onSubmit={submit}
      saving={saving}
      footer={
        params.id ? (
          <TextButton label={t('habits.delete')} color="danger" onPress={() => void remove()} />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: params.id ? t('habits.edit') : t('habits.new') }} />
      <TextField
        label={t('habits.name')}
        required
        value={form.name}
        onChangeText={(name) => set({ name })}
        error={errors.name}
        placeholder={t('habits.namePlaceholder')}
        autoFocus={!params.id}
      />
      <FieldShell label={t('habits.icon')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {habitIcons.map((icon) => {
            const on = form.icon === icon;
            return (
              <Pressable
                key={icon}
                accessibilityRole="button"
                accessibilityLabel={icon}
                accessibilityState={{ selected: on }}
                onPress={() => set({ icon })}
                style={{
                  width: minTouchSize,
                  height: minTouchSize,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: on ? colors.primary : colors.border,
                  backgroundColor: on ? colors.primarySoft : colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather
                  name={icon as ComponentProps<typeof Feather>['name']}
                  size={20}
                  color={on ? colors.primary : colors.text}
                />
              </Pressable>
            );
          })}
        </View>
      </FieldShell>
      <FieldShell label={t('habits.color')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {subjectColors.map((c) => {
            const on = form.colorId === c.id;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={c.id}
                accessibilityState={{ selected: on }}
                onPress={() => set({ colorId: c.id })}
                style={{
                  width: minTouchSize,
                  height: minTouchSize,
                  borderRadius: minTouchSize / 2,
                  backgroundColor: scheme === 'dark' ? c.strongDark : c.strong,
                  borderWidth: on ? 3 : 0,
                  borderColor: colors.text,
                }}
              />
            );
          })}
        </View>
      </FieldShell>
      <FieldShell label={t('habits.frequency')} error={errors.weekdays}>
        <Segmented
          value={form.frequency ?? 'daily'}
          onChange={(frequency) => set({ frequency })}
          options={habitFrequencies.map((f) => ({ value: f, label: t(`habits.freq.${f}`) }))}
        />
      </FieldShell>
      {form.frequency === 'weekdays' ? (
        <ChoiceChips
          label={t('habits.weekdays')}
          options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({
            value: d,
            label: labels.weekday(d, 'short'),
          }))}
          selected={form.weekdays ?? []}
          onToggle={(d) => {
            const list = form.weekdays ?? [];
            set({ weekdays: list.includes(d) ? list.filter((x) => x !== d) : [...list, d] });
          }}
        />
      ) : null}
      {form.frequency === 'weekly' ? (
        <ChoiceChips
          label={t('habits.timesPerWeek')}
          options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: String(n) }))}
          selected={[form.timesPerWeek ?? 1]}
          onToggle={(timesPerWeek) => set({ timesPerWeek })}
        />
      ) : null}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('habits.target')}
            value={form.target}
            onChangeText={(target) => set({ target })}
            error={errors.target}
            keyboardType="number-pad"
            hint={t('habits.targetHint')}
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('habits.unit')}
            value={form.unit ?? ''}
            onChangeText={(unit) => set({ unit })}
            placeholder={t('habits.unitPlaceholder')}
            editable={Number(form.target) > 1}
          />
        </View>
      </View>
      <DateTimeField
        label={t('habits.reminder')}
        mode="time"
        clearable
        value={form.reminderTime ?? null}
        onChange={(reminderTime) => set({ reminderTime })}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">{t('habits.autoStudy')}</AppText>
          <AppText variant="caption" color="muted">
            {t('habits.autoStudyHint')}
          </AppText>
        </View>
        <Switch
          accessibilityLabel={t('habits.autoStudy')}
          value={form.autoStudy ?? false}
          onValueChange={(autoStudy) => set({ autoStudy })}
          trackColor={{ true: colors.success, false: colors.border }}
        />
      </View>
    </FormScreen>
  );
}
