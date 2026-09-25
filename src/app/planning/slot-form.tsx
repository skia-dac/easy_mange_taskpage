import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import { SpacePicker } from '@/components/SpaceUi';
import { useLabels } from '@/hooks/useLabels';
import { useWeekStart } from '@/hooks/useWeekStart';
import {
  createSlot,
  deleteSlot,
  getSlot,
  isOvernight,
  slotRotations,
  updateSlot,
  type SlotInput,
} from '@/modules/productivity';
import { toIsoDate, weekdayOrder } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { useSpaces } from '@/shared/SpacesContext';
import { subjectColors, useTheme } from '@/shared/theme';
import {
  AppText,
  ChoiceChips,
  confirmDestructive,
  DateTimeField,
  FieldShell,
  FormScreen,
  showError,
  TextButton,
  TextField,
  useSave,
} from '@/shared/ui';

/** Créneau fixe du planning : jours, heures, rotation A / B, période de validité. */
export default function SlotFormScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { colors, scheme } = useTheme();
  const weekStart = useWeekStart();
  const spaces = useSpaces();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [form, setForm] = useState<SlotInput>({
    title: '',
    weekdays: [1, 2, 3, 4, 5],
    startTime: '08:00',
    endTime: '17:00',
    location: '',
    note: '',
    rotation: 'every',
    validFrom: toIsoDate(new Date()),
    validUntil: null,
    colorId: 'blue',
    space: spaces.has('work') ? 'work' : 'personal',
  });
  const { errors, saving, run } = useSave();
  const set = (patch: Partial<SlotInput>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!id) return;
    void getSlot(db, id).then((s) => s && setForm(s));
  }, [db, id]);

  const submit = () =>
    run(async () => {
      if (id) await updateSlot(db, id, form);
      else await createSlot(db, form);
      router.back();
    });

  const remove = async () => {
    if (!id) return;
    const ok = await confirmDestructive(
      t('planning.deleteTitle', { title: form.title }),
      t('planning.deleteMessage'),
      t('common.delete'),
    );
    if (!ok) return;
    try {
      await deleteSlot(db, id);
      router.back();
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  const days = form.weekdays ?? [];
  const toggleDay = (d: number) =>
    set({ weekdays: days.includes(d) ? days.filter((x) => x !== d) : [...days, d] });

  return (
    <FormScreen
      submitLabel={t('common.save')}
      onSubmit={submit}
      saving={saving}
      footer={
        id ? (
          <TextButton label={t('planning.delete')} color="danger" onPress={() => void remove()} />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: id ? t('planning.editSlot') : t('planning.newSlot') }} />
      <TextField
        label={t('planning.slotTitle')}
        required
        value={form.title}
        onChangeText={(title) => set({ title })}
        error={errors.title}
        placeholder={t('planning.slotTitlePlaceholder')}
        autoFocus={!id}
      />
      <SpacePicker
        value={form.space ?? 'work'}
        onChange={(space) => set({ space })}
        allowStudy={false}
      />
      <ChoiceChips
        label={t('planning.days')}
        options={weekdayOrder(weekStart).map((d) => ({
          value: d,
          label: labels.weekday(d, 'short'),
        }))}
        selected={days}
        onToggle={toggleDay}
      />
      {errors.weekdays ? (
        <AppText variant="caption" color="danger">
          {t(errors.weekdays)}
        </AppText>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <DateTimeField
            label={t('planning.start')}
            mode="time"
            required
            value={form.startTime}
            onChange={(v) => v && set({ startTime: v })}
            error={errors.startTime}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DateTimeField
            label={t('planning.end')}
            mode="time"
            required
            value={form.endTime}
            onChange={(v) => v && set({ endTime: v })}
            error={errors.endTime}
          />
        </View>
      </View>
      {isOvernight(form) ? (
        <AppText variant="caption" color="muted">
          {t('planning.overnight', { end: form.endTime })}
        </AppText>
      ) : null}
      <ChoiceChips
        label={t('planning.rotation')}
        options={slotRotations.map((r) => ({ value: r, label: t(`planning.rotations.${r}`) }))}
        selected={[form.rotation ?? 'every']}
        onToggle={(rotation) => set({ rotation })}
      />
      <TextField
        label={t('planning.location')}
        value={form.location ?? ''}
        onChangeText={(location) => set({ location })}
        error={errors.location}
        placeholder={t('common.optional')}
      />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <DateTimeField
            label={t('planning.from')}
            mode="date"
            required
            value={form.validFrom}
            onChange={(v) => v && set({ validFrom: v })}
            error={errors.validFrom}
          />
        </View>
        <View style={{ flex: 1 }}>
          <DateTimeField
            label={t('planning.until')}
            mode="date"
            clearable
            value={form.validUntil ?? null}
            onChange={(validUntil) => set({ validUntil })}
            error={errors.validUntil}
          />
        </View>
      </View>
      <FieldShell label={t('subjects.color')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {subjectColors.map((c, i) => {
            const selected = form.colorId === c.id;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t('subjects.colorName', { n: i + 1 })}
                onPress={() => set({ colorId: c.id })}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: scheme === 'dark' ? c.strongDark : c.strong,
                  borderWidth: selected ? 3 : 0,
                  borderColor: colors.text,
                }}
              />
            );
          })}
        </View>
      </FieldShell>
      <TextField
        label={t('planning.note')}
        value={form.note ?? ''}
        onChangeText={(note) => set({ note })}
        error={errors.note}
        placeholder={t('common.optional')}
        multiline
      />
    </FormScreen>
  );
}
