import { router, Stack, useLocalSearchParams } from 'expo-router';

import { EditLoadView } from '@/components/EditLoadView';
import { goBack } from '@/components/navigation';
import { useEditLoad } from '@/hooks/useEditLoad';
import { useDirty, useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountDisplay } from '@/components/money/AmountDisplay';
import { AmountPad } from '@/components/money/AmountPad';
import { amountPadMode } from '@/components/money/amountPadLayout';
import { CategoryPicker } from '@/components/money/CategoryPicker';
import { EntryDetails } from '@/components/money/EntryDetails';
import { haptic } from '@/shared/ui/haptics';
import { MONEY_INTEGER_DIGITS } from '@/shared/fieldLimits';
import { useMoneyLabels } from '@/components/money/useMoneyLabels';
import {
  amountInput,
  categoriesOf,
  categoryUsage,
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
  rankCategories,
  transactionKinds,
  updateTransaction,
  type Transaction,
  type TransactionKind,
} from '@/modules/finance';
import { addDaysIso, toIsoDate } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { isValidationError } from '@/shared/validation';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  confirmDestructive,
  Segmented,
  showError,
  TextButton,
  KeyboardAvoiding,
  useTextScale,
  reportLoadError,
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

/** Les catégories sont rangées d'après l'usage des 90 derniers jours. */
const USAGE_DAYS = 90;

/**
 * Saisie rapide d'une opération, à une main : le montant en haut (tapé sur le pavé, sous le
 * pouce), la catégorie la plus utilisée déjà choisie, puis « Ajouter 2 500 FCFA · Nourriture ».
 * La date du jour et la note sont facultatives, repliées. Sert aussi à modifier une opération, à
 * mettre de côté (objectif) et à noter un remboursement (prêt).
 */
export default function MoneyAddScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const windowSize = useWindowDimensions();
  const textScale = useTextScale();
  const params = useLocalSearchParams<Params>();
  const today = toIsoDate(new Date());
  const [kind, setKind] = useState<TransactionKind>(
    transactionKinds.includes(params.kind as TransactionKind)
      ? (params.kind as TransactionKind)
      : 'expense',
  );
  const [categoryId, setCategoryId] = useState<string | null>(params.category ?? null);
  const [digits, setDigits] = useState('');
  // Clavier ouvert (champ note) : le pavé se retire pour laisser la place au texte.
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardOpen(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const [date, setDate] = useState(params.date ?? today);
  const [note, setNote] = useState('');
  const [preferredCurrency, setCurrency] = useState('XAF');
  const [existing, setExisting] = useState<Transaction | null>(null);
  // Modification : le formulaire n'apparaît qu'une fois l'opération lue (pas de bouton
  // Enregistrer qui créerait un doublon) ; « n'existe plus » si elle a disparu, « Réessayer » si
  // la lecture a échoué.
  const load = useEditLoad(
    params.id,
    (id) => getTransaction(db, id),
    (tx) => {
      setExisting(tx);
      setKind(tx.kind);
      setCategoryId(tx.categoryId);
      setDigits(amountInput(tx.amountMinor, tx.currency));
      setDate(tx.date);
      setNote(tx.note ?? '');
      setCurrency(tx.currency);
    },
  );
  const loadState = load.state;
  const [error, setError] = useState<string | null>(null);
  /** Erreur de saisie de la note, sous son champ. */
  const [noteError, setNoteError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  // Garde synchrone : deux appuis dans la même image passent tous deux avant que `saving` soit
  // rendu, et créeraient deux opérations.
  const savingRef = useRef(false);
  const { dirty } = useDirty({ kind, categoryId, digits, date, note }, loadState === 'ready');
  const leave = useUnsavedGuard(dirty);
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

  // Nouvelle opération : la devise choisie dans les réglages de l'argent (l'opération modifiée
  // garde la sienne).
  useEffect(() => {
    if (params.id) return;
    getMoneyPrefs(db).then((prefs) => setCurrency(prefs.currency), reportLoadError);
  }, [db, params.id]);

  // Mouvement lié à un prêt ou à un objectif : il a forcément leur devise.
  const currency =
    context.data?.loan?.currency ?? context.data?.goal?.currency ?? preferredCurrency;

  const plain = kind === 'expense' || kind === 'income';
  const categoryKind = kind === 'income' ? 'income' : 'expense';
  const usageSince = addDaysIso(today, -USAGE_DAYS);
  const usage = useLiveQuery(
    (d) => (plain ? categoryUsage(d, categoryKind, usageSince) : Promise.resolve([])),
    ['money_transactions'],
    [plain, categoryKind, usageSince],
  );
  const cats = useMemo(
    () =>
      plain ? rankCategories(categoriesOf(categoryKind, custom.data ?? []), usage.data ?? []) : [],
    [plain, categoryKind, custom.data, usage.data],
  );
  const decimals = isCurrency(currency) ? currencies[currency].decimals : 2;
  const amount = parseAmount(digits || '0', currency);
  // Aucune catégorie touchée : la plus utilisée (un appui de moins dans le cas courant).
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
      const digits = (next.split(',')[0] ?? '').replace(/^0+(?=\d)/, '');
      return digits.length > MONEY_INTEGER_DIGITS - decimals ? d : next;
    });
  };
  const clear = () => {
    setError(null);
    setDigits('');
  };

  const save = async () => {
    if (savingRef.current) return;
    if (!amount) {
      setError(t('money.invalidAmount'));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setNoteError(undefined);
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
      haptic('success');
      // Réussi : la garde reste fermée, l'écran se referme (aucun second enregistrement).
      leave(close);
    } catch (e) {
      savingRef.current = false;
      setSaving(false);
      if (isValidationError(e)) {
        // Erreurs de saisie à leur place : la note sous son champ ; le montant (ex. remboursement
        // au-delà du reste dû) et le reste sous le montant. Jamais de message générique.
        const { note: noteKey, ...others } = e.fields;
        setNoteError(noteKey);
        const other = others.amountMinor ?? Object.values(others)[0];
        setError(other ? t(other) : null);
      } else showError(userMessageKey(e));
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
      deleteTransaction(db, existing.id).then(
        () => leave(close),
        (e: unknown) => showError(userMessageKey(e)),
      );
  };

  const title = existing
    ? t('money.editTitle')
    : kind === 'expense'
      ? t('money.newExpense')
      : kind === 'income'
        ? t('money.newIncome')
        : money.kind(kind);
  const subject = context.data?.goal?.name ?? context.data?.loan?.person ?? null;
  const categoryName = plain && selected ? money.nameOf(selected) : null;
  const formatted = amount ? formatMoney(amount, currency) : null;
  // Le bouton résume l'action : « Ajouter 2 500 FCFA · Nourriture ».
  const saveLabel = existing
    ? formatted && categoryName
      ? t('money.saveWithAmount', { amount: formatted, category: categoryName })
      : formatted
        ? t('money.saveAmountOnly', { amount: formatted })
        : t('money.save')
    : categoryName
      ? formatted
        ? t('money.addWithAmount', { amount: formatted, category: categoryName })
        : t('money.addNoAmount', { category: categoryName })
      : formatted
        ? t('money.saveAmountOnly', { amount: formatted })
        : t('money.save');

  // Petit écran ou grand texte : pavé compact ; s'il prend encore trop de place, le pavé défile
  // avec le reste et seul « Enregistrer » reste fixé en bas.
  const padMode = amountPadMode({
    windowHeight: windowSize.height,
    scale: textScale,
    hasDelete: existing !== null,
    bottomInset: insets.bottom,
  });
  const compact = padMode !== 'regular';
  const inline = padMode === 'inline';
  const pad = keyboardOpen ? null : (
    <AmountPad decimals={decimals} mode={padMode} onKey={press} onClear={clear} />
  );

  if (loadState !== 'ready')
    return <EditLoadView state={loadState} onRetry={load.retry} title={t('money.editTitle')} />;

  return (
    <KeyboardAvoiding>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: compact ? spacing.md : spacing.lg,
          paddingBottom: spacing.lg,
          gap: compact ? spacing.md : spacing.lg,
        }}
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
          <AppText variant="heading" style={{ textAlign: 'center' }}>
            {subject}
          </AppText>
        ) : null}

        <AmountDisplay
          digits={digits}
          currency={currency}
          income={kind === 'income'}
          compact={compact}
          error={error}
        />

        {plain ? (
          <CategoryPicker
            categories={cats}
            selectedId={selected}
            onSelect={setCategoryId}
            onCreate={() =>
              router.push({ pathname: '/money/category-form', params: { kind: categoryKind } })
            }
            nameOf={money.categoryName}
          />
        ) : null}

        {inline ? pad : null}

        <EntryDetails
          today={today}
          date={date}
          onDate={setDate}
          note={note}
          onNote={(v) => {
            setNote(v);
            setNoteError(undefined);
          }}
          noteError={noteError}
        />
      </ScrollView>
      {/* Pied fixe, sous le pouce : le pavé (sauf s'il ne laisse plus de place, voir `padMode`)
          et le bouton Enregistrer, toujours visible. */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: compact ? spacing.sm : spacing.md,
          paddingBottom: (compact ? spacing.sm : spacing.md) + insets.bottom,
          gap: compact ? spacing.sm : spacing.md,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        }}
      >
        {inline ? null : pad}
        <Button label={saveLabel} onPress={() => void save()} disabled={saving || !amount} />
        {existing ? (
          <TextButton label={t('money.delete')} color="danger" onPress={() => void remove()} />
        ) : null}
      </View>
    </KeyboardAvoiding>
  );
}
