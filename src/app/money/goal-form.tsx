import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  amountInput,
  createGoal,
  deleteGoal,
  getGoal,
  getMoneyPrefs,
  parseAmount,
  updateGoal,
} from '@/modules/finance';
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

/** Créer ou modifier un objectif d'épargne. */
export default function GoalFormScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [currency, setCurrency] = useState('XAF');
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState<string | null>(null);
  const { errors, saving, run } = useSave();

  useEffect(() => {
    void (async () => {
      setCurrency((await getMoneyPrefs(db)).currency);
      if (!id) return;
      const g = await getGoal(db, id);
      if (!g) return;
      setCurrency(g.currency);
      setName(g.name);
      setTarget(amountInput(g.targetMinor, g.currency));
      setDeadline(g.deadline);
    })();
  }, [db, id]);

  const submit = () =>
    run(async () => {
      const input = {
        name,
        targetMinor: parseAmount(target, currency) ?? Number.NaN,
        currency,
        deadline,
      };
      if (id) await updateGoal(db, id, input);
      else await createGoal(db, input);
      router.back();
    });

  const remove = async () => {
    if (!id) return;
    const ok = await confirmDestructive(
      t('money.deleteGoalTitle', { name }),
      t('money.deleteGoalMessage'),
      t('common.delete'),
    );
    if (ok)
      deleteGoal(db, id).then(
        () => router.back(),
        (e: unknown) => showError(userMessageKey(e)),
      );
  };

  return (
    <FormScreen
      submitLabel={t('money.saveGoal')}
      onSubmit={submit}
      saving={saving}
      footer={
        id ? (
          <TextButton label={t('common.delete')} color="danger" onPress={() => void remove()} />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: id ? t('money.editGoal') : t('money.newGoal') }} />
      <TextField
        label={t('money.goalName')}
        required
        value={name}
        onChangeText={setName}
        error={errors.name}
        placeholder={t('money.goalPlaceholder')}
      />
      <TextField
        label={t('money.goalTarget')}
        required
        value={target}
        onChangeText={setTarget}
        error={errors.targetMinor}
        keyboardType="decimal-pad"
        placeholder="0"
      />
      <DateTimeField
        label={t('money.goalDeadlineLabel')}
        mode="date"
        clearable
        value={deadline}
        onChange={setDeadline}
      />
    </FormScreen>
  );
}
