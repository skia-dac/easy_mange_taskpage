import { useTranslation } from 'react-i18next';

import {
  findCategory,
  formatMoney,
  type MoneyCategory,
  type TransactionKind,
} from '@/modules/finance';

/** Textes de l'argent : nom d'une catégorie (de l'app ou personnelle), montant formaté. */
export function useMoneyLabels(custom: readonly MoneyCategory[] = []) {
  const { t } = useTranslation();
  const categoryName = (c: MoneyCategory | undefined) =>
    !c ? t('money.cat.other') : c.builtIn ? t(`money.cat.${c.id}`) : (c.name ?? '');
  return {
    categoryName,
    categoryOf: (id: string | null) => findCategory(id, custom),
    nameOf: (id: string | null) => categoryName(findCategory(id, custom)),
    money: formatMoney,
    kind: (k: TransactionKind) => t(`money.kind.${k}`),
  };
}
