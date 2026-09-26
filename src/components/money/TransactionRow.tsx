import { router } from 'expo-router';

import { formatMoney, isInflow, type MoneyCategory, type Transaction } from '@/modules/finance';
import { formatShortDate } from '@/shared/format';
import { AppText, ListRow } from '@/shared/ui';

import { CategoryBadge } from './CategoryBadge';
import { useMoneyLabels } from './useMoneyLabels';

/** Une opération : catégorie, note, montant (+ vert pour l'argent qui entre). */
export function TransactionRow({
  item,
  categories,
  lang,
  showDate,
}: {
  item: Transaction;
  categories: readonly MoneyCategory[];
  lang: string;
  showDate?: boolean;
}) {
  const labels = useMoneyLabels(categories);
  const category = labels.categoryOf(item.categoryId);
  const inflow = isInflow(item.kind);
  const title =
    item.kind === 'expense' || item.kind === 'income'
      ? labels.categoryName(category)
      : labels.kind(item.kind);
  return (
    <ListRow
      title={title}
      subtitle={
        [showDate ? formatShortDate(item.date, lang) : null, item.note]
          .filter(Boolean)
          .join(' · ') || null
      }
      leading={<CategoryBadge category={category} />}
      trailing={
        <AppText variant="bodyStrong" color={inflow ? 'success' : 'text'}>
          {formatMoney(inflow ? item.amountMinor : -item.amountMinor, item.currency, {
            signed: true,
            symbol: false,
          })}
        </AppText>
      }
      onPress={() => router.push({ pathname: '/money/add', params: { id: item.id } })}
    />
  );
}
