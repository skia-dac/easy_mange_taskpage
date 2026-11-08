import { Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/components/navigation';
import { EditLoadView } from '@/components/EditLoadView';
import { useEditLoad } from '@/hooks/useEditLoad';
import { useDirty, useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  amountInput,
  createGoal,
  currencies,
  isCurrency,
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
  fieldLimits,
  moneyLimit,
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

  // La devise vient des réglages (création) ou de l'objectif (modification) : les champs
  // n'apparaissent qu'une fois lus, jamais écrasés pendant la saisie.
  const load = useEditLoad(
    id ?? 'new',
    async () => {
      const prefs = await getMoneyPrefs(db);
      if (!id) return { currency: prefs.currency, goal: null };
      const goal = await getGoal(db, id);
      return goal ? { currency: goal.currency, goal } : null;
    },
    ({ currency: c, goal: g }) => {
      setCurrency(c);
      if (!g) return;
      setName(g.name);
      setTarget(amountInput(g.targetMinor, g.currency));
      setDeadline(g.deadline);
    },
  );
  const { dirty } = useDirty({ name, target, deadline }, load.state === 'ready');
  const leave = useUnsavedGuard(dirty);

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
      leave(goBack);
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
        () => leave(goBack),
        (e: unknown) => showError(userMessageKey(e)),
      );
  };

  if (load.state !== 'ready')
    return (
      <EditLoadView
        state={load.state}
        onRetry={load.retry}
        title={id ? t('money.editGoal') : t('money.newGoal')}
      />
    );

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
        limit={fieldLimits.name60}
        placeholder={t('money.goalPlaceholder')}
      />
      <TextField
        label={t('money.goalTarget')}
        required
        value={target}
        onChangeText={setTarget}
        error={errors.targetMinor}
        limit={moneyLimit(isCurrency(currency) ? currencies[currency].decimals : 2)}
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
