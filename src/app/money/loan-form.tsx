import { Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/components/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  createLoan,
  deleteLoan,
  currencies,
  getLoan,
  getMoneyPrefs,
  isCurrency,
  parseAmount,
  updateLoan,
  type LoanDirection,
} from '@/modules/finance';
import { toIsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { ValidationError } from '@/shared/validation';
import {
  AppText,
  confirmDestructive,
  DateTimeField,
  FormScreen,
  Segmented,
  showError,
  TextButton,
  TextField,
  fieldLimits,
  moneyLimit,
  useSave,
} from '@/shared/ui';

/** Noter un prêt (on me doit / je dois). L'argent prêté sort de ce qu'il te reste. */
export default function LoanFormScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const params = useLocalSearchParams<{ id?: string; direction?: string }>();
  const today = toIsoDate(new Date());
  const [currency, setCurrency] = useState('XAF');
  const [direction, setDirection] = useState<LoanDirection>(
    params.direction === 'borrowed' ? 'borrowed' : 'lent',
  );
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const { errors, saving, run } = useSave();

  useEffect(() => {
    void (async () => {
      setCurrency((await getMoneyPrefs(db)).currency);
      if (!params.id) return;
      const l = await getLoan(db, params.id);
      if (!l) return;
      setDirection(l.direction);
      setPerson(l.person);
      setDueDate(l.dueDate);
      setNote(l.note ?? '');
    })();
  }, [db, params.id]);

  const submit = () =>
    run(async () => {
      const input = { direction, person, dueDate, note };
      if (params.id) await updateLoan(db, params.id, input);
      else {
        const minor = parseAmount(amount, currency);
        if (!minor) throw new ValidationError({ amount: 'money.invalidAmount' });
        await createLoan(db, input, { amountMinor: minor, currency, date });
      }
      goBack();
    });

  const remove = async () => {
    if (!params.id) return;
    const ok = await confirmDestructive(
      t('money.deleteLoanTitle', { name: person }),
      t('money.deleteLoanMessage'),
      t('common.delete'),
    );
    if (ok)
      deleteLoan(db, params.id).then(
        () => goBack(),
        (e: unknown) => showError(userMessageKey(e)),
      );
  };

  return (
    <FormScreen
      submitLabel={t('money.saveLoan')}
      onSubmit={submit}
      saving={saving}
      footer={
        params.id ? (
          <TextButton label={t('common.delete')} color="danger" onPress={() => void remove()} />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: params.id ? t('money.editLoan') : t('money.newLoan') }} />
      {!params.id ? (
        <Segmented
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'lent', label: t('money.iLent') },
            { value: 'borrowed', label: t('money.iBorrowed') },
          ]}
        />
      ) : null}
      <TextField
        label={direction === 'lent' ? t('money.lentTo') : t('money.borrowedFrom')}
        required
        value={person}
        onChangeText={setPerson}
        error={errors.person}
        limit={fieldLimits.person}
        placeholder={t('money.personPlaceholder')}
      />
      {!params.id ? (
        <>
          <TextField
            label={t('money.amount')}
            required
            value={amount}
            onChangeText={setAmount}
            error={errors.amount ?? errors.amountMinor}
            limit={moneyLimit(isCurrency(currency) ? currencies[currency].decimals : 2)}
            placeholder="0"
          />
          <DateTimeField
            label={t('money.date')}
            mode="date"
            required
            value={date}
            onChange={(v) => setDate(v ?? today)}
          />
        </>
      ) : (
        <AppText color="muted">{t('money.loanEditHint')}</AppText>
      )}
      <DateTimeField
        label={t('money.loanDueLabel')}
        mode="date"
        clearable
        value={dueDate}
        onChange={setDueDate}
      />
      <TextField
        label={t('money.note')}
        value={note}
        onChangeText={setNote}
        error={errors.note}
        limit={fieldLimits.note200}
        placeholder={t('common.optional')}
      />
    </FormScreen>
  );
}
