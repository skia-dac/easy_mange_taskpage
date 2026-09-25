import Feather from '@expo/vector-icons/Feather';
import { Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/components/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CategoryBadge } from '@/components/money/CategoryBadge';
import { useMoneyLabels } from '@/components/money/useMoneyLabels';
import { useLabels } from '@/hooks/useLabels';
import {
  amountInput,
  categoriesOf,
  createTransaction,
  currencies,
  deleteTransaction,
  formatMoney,
  getGoal,
  getLoan,
  getMoneyPrefs,
  getTransaction,
  isCurrency,
  listCategories,
  parseAmount,
  transactionKinds,
  updateTransaction,
  type Transaction,
  type TransactionKind,
} from '@/modules/finance';
import { fromIsoDate, toIsoDate } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatLongDate } from '@/shared/format';
import { minTouchSize, useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  confirmDestructive,
  DateTimeField,
  Segmented,
  showError,
  TextButton,
  TextField,
  KeyboardAvoiding,
} from '@/shared/ui';

type Params = {
  id?: string;
  kind?: string;
  category?: string;
  goalId?: string;
  loanId?: string;
  date?: string;
};

const close = () => goBack('/(tabs)/money');

/**
 * Saisie rapide d'une opération : dépense ou entrée → catégorie → montant → Enregistrer.
 * La date du jour est choisie par défaut (modifiable). Sert aussi à modifier une opération,
 * à mettre de côté (objectif) et à noter un remboursement (prêt).
 */
export default function MoneyAddScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();
  const today = toIsoDate(new Date());
  const [kind, setKind] = useState<TransactionKind>(
    transactionKinds.includes(params.kind as TransactionKind)
      ? (params.kind as TransactionKind)
      : 'expense',
  );
  const [categoryId, setCategoryId] = useState<string | null>(params.category ?? null);
  const [digits, setDigits] = useState('');
  const [date, setDate] = useState(params.date ?? today);
  const [note, setNote] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [existing, setExisting] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const custom = useLiveQuery(listCategories, ['money_categories'], []);
  const money = useMoneyLabels(custom.data ?? []);
  const goalId = existing?.goalId ?? params.goalId ?? null;
  const loanId = existing?.loanId ?? params.loanId ?? null;
  const context = useLiveQuery(
    async (d) => ({
      goal: goalId ? await getGoal(d, goalId) : null,
      loan: loanId ? await getLoan(d, loanId) : null,
    }),
    ['money_goals', 'money_loans'],
    [goalId, loanId],
  );

  useEffect(() => {
    void (async () => {
      const prefs = await getMoneyPrefs(db);
      if (!params.id) {
        setCurrency(prefs.currency);
        return;
      }
      const tx = await getTransaction(db, params.id);
      if (!tx) return;
      setExisting(tx);
      setKind(tx.kind);
      setCategoryId(tx.categoryId);
      setDigits(amountInput(tx.amountMinor, tx.currency));
      setDate(tx.date);
      setNote(tx.note ?? '');
      setCurrency(tx.currency);
    })();
  }, [db, params.id]);

  const plain = kind === 'expense' || kind === 'income';
  const cats = useMemo(
    () => (plain ? categoriesOf(kind === 'income' ? 'income' : 'expense', custom.data ?? []) : []),
    [plain, kind, custom.data],
  );
  const decimals = isCurrency(currency) ? currencies[currency].decimals : 2;
  const amount = parseAmount(digits || '0', currency);
  const selected = categoryId ?? cats[0]?.id ?? null;

  const press = (k: string) => {
    setError(null);
    if (k === 'back') return setDigits((d) => d.slice(0, -1));
    if (k === ',')
      return setDigits((d) => (d.includes(',') || decimals === 0 ? d : `${d || '0'},`));
    setDigits((d) => {
      const next = d === '0' ? k : d + k;
      const frac = next.split(',')[1];
      if (frac !== undefined && frac.length > decimals) return d;
      return next.replace(/^0+(?=\d)/, '').length > 12 ? d : next;
    });
  };

  const save = async () => {
    if (!amount) {
      setError(t('money.invalidAmount'));
      return;
    }
    setSaving(true);
    const input = {
      kind,
      amountMinor: amount,
      currency,
      categoryId: plain ? selected : null,
      date,
      note,
      recurringId: existing?.recurringId ?? null,
      occurrenceDate: existing?.occurrenceDate ?? null,
      goalId,
      loanId,
    };
    try {
      if (existing) await updateTransaction(db, existing.id, input);
      else await createTransaction(db, input);
      close();
    } catch (e) {
      setSaving(false);
      showError(userMessageKey(e));
    }
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await confirmDestructive(
      t('money.deleteTitle'),
      t('money.deleteMessage'),
      t('common.delete'),
    );
    if (ok)
      deleteTransaction(db, existing.id).then(close, (e: unknown) => showError(userMessageKey(e)));
  };

  const title = existing
    ? t('money.editTitle')
    : kind === 'expense'
      ? t('money.newExpense')
      : kind === 'income'
        ? t('money.newIncome')
        : money.kind(kind);
  const subject = context.data?.goal?.name ?? context.data?.loan?.person ?? null;
  const keys = [
    '1',
    '2',
    '3',
    '4',
    '5',
    '6',
    '7',
    '8',
    '9',
    decimals > 0 ? ',' : '000',
    '0',
    'back',
  ];

  return (
    <KeyboardAvoiding>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Stack.Screen options={{ title }} />
        {plain ? (
          <Segmented
            accessibilityLabel={t('money.kindLabel')}
            value={kind}
            onChange={(k) => {
              setKind(k);
              setCategoryId(null);
            }}
            options={[
              { value: 'expense', label: t('money.expense') },
              { value: 'income', label: t('money.income') },
            ]}
          />
        ) : subject ? (
          <AppText variant="heading">{subject}</AppText>
        ) : null}

        {plain ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {cats.map((c) => {
              const on = c.id === selected;
              return (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={money.categoryName(c)}
                  onPress={() => setCategoryId(c.id)}
                  style={{
                    width: '23%',
                    flexGrow: 1,
                    minHeight: 76,
                    borderRadius: radius.md,
                    borderWidth: on ? 2 : 1.5,
                    borderColor: on ? colors.primary : colors.border,
                    backgroundColor: on ? colors.primarySoft : colors.surface,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.xs,
                    padding: spacing.xs,
                  }}
                >
                  <CategoryBadge category={c} size={30} />
                  <AppText variant="caption" numberOfLines={1} style={{ textAlign: 'center' }}>
                    {money.categoryName(c)}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={{ gap: spacing.xs }}>
          <DateTimeField
            label={t('money.date')}
            mode="date"
            required
            value={date}
            onChange={(v) => setDate(v ?? today)}
          />
          <AppText variant="caption" color={date === today ? 'muted' : 'warning'}>
            {date === today
              ? t('money.dateIsToday')
              : t('money.dateOther', { date: formatLongDate(fromIsoDate(date), labels.lang) })}
          </AppText>
        </View>

        <TextField
          label={t('money.note')}
          value={note}
          onChangeText={setNote}
          placeholder={t('common.optional')}
          maxLength={120}
        />
      </ScrollView>
      {/* Pied fixe : montant, pavé et bouton restent visibles, quelle que soit la taille d'écran. */}
      <View
        style={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
          paddingBottom: spacing.md + insets.bottom,
          gap: spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        <View style={{ alignItems: 'center', gap: spacing.xs }}>
          <AppText
            variant="title"
            color={kind === 'income' ? 'success' : 'text'}
            style={{ fontSize: 36, lineHeight: 44 }}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLiveRegion="polite"
          >
            {amount
              ? formatMoney(amount, currency)
              : `0 ${isCurrency(currency) ? currencies[currency].symbol : currency}`}
          </AppText>
          {error ? <AppText color="danger">{error}</AppText> : null}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {keys.map((k) => (
            <Pressable
              key={k}
              accessibilityRole="button"
              accessibilityLabel={k === 'back' ? t('money.erase') : k}
              onPress={() => press(k)}
              style={({ pressed }) => ({
                width: '31%',
                flexGrow: 1,
                minHeight: minTouchSize + 4,
                borderRadius: radius.md,
                backgroundColor: pressed ? colors.primarySoft : colors.surface,
                alignItems: 'center',
                justifyContent: 'center',
              })}
            >
              {k === 'back' ? (
                <Feather name="delete" size={22} color={colors.text} />
              ) : (
                <AppText variant="heading">{k}</AppText>
              )}
            </Pressable>
          ))}
        </View>

        <Button
          label={
            plain && selected
              ? t(kind === 'income' ? 'money.saveIncome' : 'money.saveExpense', {
                  category: money.categoryName(cats.find((c) => c.id === selected)),
                })
              : t('money.save')
          }
          onPress={() => void save()}
          disabled={saving}
        />
        {existing ? (
          <TextButton label={t('money.delete')} color="danger" onPress={() => void remove()} />
        ) : null}
      </View>
    </KeyboardAvoiding>
  );
}
