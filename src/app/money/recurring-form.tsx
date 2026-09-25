import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, View } from 'react-native';

import { remindersText } from '@/components/money/recurringText';
import { useMoneyLabels } from '@/components/money/useMoneyLabels';
import { useLabels } from '@/hooks/useLabels';
import {
  amountInput,
  categoriesOf,
  createRecurring,
  deleteRecurring,
  getMoneyPrefs,
  getRecurring,
  listCategories,
  MAX_REMINDERS,
  parseAmount,
  reminderChoices,
  updateRecurring,
  type Frequency,
  type RecurringKind,
} from '@/modules/finance';
import { toIsoDate } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { useTheme } from '@/shared/theme';
import {
  AppText,
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

type Form = {
  kind: RecurringKind;
  name: string;
  categoryId: string | null;
  amount: string;
  frequency: Frequency;
  dayOfMonth: number;
  weekday: number;
  time: string | null;
  reminders: number[];
  startDate: string;
  active: boolean;
  payoutDate: string | null;
  payout: string;
  payoutAuto: boolean;
  note: string;
};

/** Créer ou modifier une charge fixe ou une tontine, avec 1 à 3 rappels au choix. */
export default function RecurringFormScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { colors, spacing } = useTheme();
  const params = useLocalSearchParams<{
    id?: string;
    kind?: string;
    name?: string;
    category?: string;
    amount?: string;
  }>();
  const today = toIsoDate(new Date());
  const [currency, setCurrency] = useState('XAF');
  const [form, setForm] = useState<Form>({
    kind: params.kind === 'tontine' ? 'tontine' : 'charge',
    name: params.name ?? '',
    categoryId: params.category ?? null,
    amount: params.amount ?? '',
    frequency: params.kind === 'tontine' ? 'weekly' : 'monthly',
    dayOfMonth: Number(today.slice(8)),
    weekday: 6,
    time: params.kind === 'tontine' ? '15:00' : null,
    reminders: params.kind === 'tontine' ? [1440, 180] : [1440],
    startDate: today,
    active: true,
    payoutDate: null,
    payout: '',
    payoutAuto: true,
    note: '',
  });
  const { errors, saving, run } = useSave();
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const cats = useLiveQuery(listCategories, ['money_categories'], []);
  const money = useMoneyLabels(cats.data ?? []);

  useEffect(() => {
    void (async () => {
      const prefs = await getMoneyPrefs(db);
      setCurrency(prefs.currency);
      if (!params.id) return;
      const r = await getRecurring(db, params.id);
      if (!r) return;
      setCurrency(r.currency);
      setForm({
        kind: r.kind,
        name: r.name,
        categoryId: r.categoryId,
        amount: amountInput(r.amountMinor, r.currency),
        frequency: r.frequency,
        dayOfMonth: r.dayOfMonth,
        weekday: r.weekday,
        time: r.time,
        reminders: r.reminders,
        startDate: r.startDate,
        active: r.active,
        payoutDate: r.payoutDate,
        payout: r.payoutMinor ? amountInput(r.payoutMinor, r.currency) : '',
        payoutAuto: r.payoutAuto,
        note: r.note ?? '',
      });
    })();
  }, [db, params.id]);

  const submit = () =>
    run(async () => {
      const input = {
        kind: form.kind,
        name: form.name,
        categoryId: form.kind === 'tontine' ? 'tontine' : form.categoryId,
        amountMinor: parseAmount(form.amount, currency) ?? Number.NaN,
        currency,
        frequency: form.frequency,
        dayOfMonth: form.dayOfMonth,
        weekday: form.weekday,
        time: form.time,
        reminders: form.reminders,
        startDate: form.startDate,
        active: form.active,
        payoutDate: form.kind === 'tontine' ? form.payoutDate : null,
        payoutMinor:
          form.kind === 'tontine' && form.payoutDate
            ? (parseAmount(form.payout, currency) ?? Number.NaN)
            : null,
        payoutAuto: form.payoutAuto,
        note: form.note,
      };
      if (params.id) await updateRecurring(db, params.id, input);
      else await createRecurring(db, input);
      router.back();
    });

  const remove = async () => {
    if (!params.id) return;
    const ok = await confirmDestructive(
      t('money.deleteRecurringTitle', { name: form.name }),
      t('money.deleteRecurringMessage'),
      t('common.delete'),
    );
    if (ok)
      deleteRecurring(db, params.id).then(
        () => router.back(),
        (e: unknown) => showError(userMessageKey(e)),
      );
  };

  const toggleReminder = (m: number) => {
    const has = form.reminders.includes(m);
    if (!has && form.reminders.length >= MAX_REMINDERS) return;
    set({ reminders: has ? form.reminders.filter((x) => x !== m) : [...form.reminders, m] });
  };

  const switchRow = (
    label: string,
    value: boolean,
    onChange: (v: boolean) => void,
    hint?: string,
  ) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        {hint ? (
          <AppText variant="caption" color="muted">
            {hint}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.success, false: colors.border }}
      />
    </View>
  );

  const tontine = form.kind === 'tontine';
  return (
    <FormScreen
      submitLabel={t('money.saveRecurring')}
      onSubmit={submit}
      saving={saving}
      footer={
        params.id ? (
          <TextButton label={t('common.delete')} color="danger" onPress={() => void remove()} />
        ) : undefined
      }
    >
      <Stack.Screen
        options={{
          title: params.id
            ? t('money.editRecurring')
            : tontine
              ? t('money.addTontine')
              : t('money.addCharge'),
        }}
      />
      {!params.id ? (
        <Segmented
          value={form.kind}
          onChange={(kind) => set({ kind })}
          options={[
            { value: 'charge', label: t('money.charge') },
            { value: 'tontine', label: t('money.tontine') },
          ]}
        />
      ) : null}
      <TextField
        label={t('money.recurringName')}
        required
        value={form.name}
        onChangeText={(name) => set({ name })}
        error={errors.name}
        placeholder={tontine ? t('money.tontinePlaceholder') : t('money.chargePlaceholder')}
      />
      <TextField
        label={tontine ? t('money.contribution') : t('money.amount')}
        required
        value={form.amount}
        onChangeText={(amount) => set({ amount })}
        error={errors.amountMinor}
        keyboardType="decimal-pad"
        placeholder="0"
      />
      {!tontine ? (
        <SelectField
          label={t('money.category')}
          value={form.categoryId}
          noneLabel={t('money.cat.other')}
          options={categoriesOf('expense', cats.data ?? []).map((c) => ({
            value: c.id,
            label: money.categoryName(c),
          }))}
          onChange={(categoryId) => set({ categoryId })}
        />
      ) : null}
      <Segmented
        value={form.frequency}
        onChange={(frequency) => set({ frequency })}
        options={[
          { value: 'monthly', label: t('money.monthly') },
          { value: 'weekly', label: t('money.weekly') },
        ]}
      />
      {form.frequency === 'monthly' ? (
        <SelectField
          label={t('money.dayOfMonth')}
          value={String(form.dayOfMonth)}
          options={Array.from({ length: 31 }, (_, i) => ({
            value: String(i + 1),
            label: t('money.dayN', { day: i + 1 }),
          }))}
          onChange={(v) => set({ dayOfMonth: Number(v ?? 1) })}
        />
      ) : (
        <ChoiceChips
          label={t('money.weekday')}
          options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({
            value: n,
            label: labels.weekday(n, 'short'),
          }))}
          selected={[form.weekday]}
          onToggle={(weekday) => set({ weekday })}
        />
      )}
      <DateTimeField
        label={t('money.time')}
        mode="time"
        clearable
        value={form.time}
        onChange={(time) => set({ time })}
      />
      <ChoiceChips
        label={t('money.reminders', { max: MAX_REMINDERS })}
        options={reminderChoices.map((m) => ({ value: m, label: remindersText([m], t) }))}
        selected={form.reminders}
        onToggle={toggleReminder}
      />
      {errors.reminders ? <AppText color="danger">{t(errors.reminders)}</AppText> : null}
      <DateTimeField
        label={t('money.startDate')}
        mode="date"
        required
        value={form.startDate}
        onChange={(v) => set({ startDate: v ?? today })}
      />
      {tontine ? (
        <>
          <AppText variant="heading">{t('money.myTurnTitle')}</AppText>
          <DateTimeField
            label={t('money.payoutDate')}
            mode="date"
            clearable
            value={form.payoutDate}
            onChange={(payoutDate) => set({ payoutDate })}
          />
          {form.payoutDate ? (
            <>
              <TextField
                label={t('money.payoutAmount')}
                required
                value={form.payout}
                onChangeText={(payout) => set({ payout })}
                error={errors.payoutMinor}
                keyboardType="decimal-pad"
                placeholder="0"
              />
              {switchRow(
                t('money.payoutAuto'),
                form.payoutAuto,
                (payoutAuto) => set({ payoutAuto }),
                t('money.payoutAutoHint'),
              )}
            </>
          ) : null}
        </>
      ) : null}
      {params.id
        ? switchRow(
            t('money.active'),
            form.active,
            (active) => set({ active }),
            t('money.activeHint'),
          )
        : null}
      <TextField
        label={t('money.note')}
        value={form.note}
        onChangeText={(note) => set({ note })}
        placeholder={t('common.optional')}
      />
    </FormScreen>
  );
}
