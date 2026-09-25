import { z } from 'zod';

import { readAppSetting, writeAppSetting, type Db } from '@/shared/db';

import { DEFAULT_CURRENCY, isCurrency } from '../domain/money';
import { budgetPeriodSchema, defaultBudgetPeriod } from '../domain/period';

/** Réglages de l'argent : monnaie, période de budget, montants masqués dans les widgets. */
export const moneyPrefsSchema = z.object({
  currency: z
    .string()
    .refine((c) => isCurrency(c))
    .default(DEFAULT_CURRENCY),
  period: budgetPeriodSchema.default(defaultBudgetPeriod),
  hideWidgetAmounts: z.boolean().default(false),
});
export type MoneyPrefs = z.output<typeof moneyPrefsSchema>;
export const defaultMoneyPrefs: MoneyPrefs = {
  currency: DEFAULT_CURRENCY,
  period: defaultBudgetPeriod,
  hideWidgetAmounts: false,
};

const KEY = 'money_prefs';

export async function getMoneyPrefs(db: Db): Promise<MoneyPrefs> {
  const parsed = moneyPrefsSchema.safeParse((await readAppSetting(db, KEY)) ?? {});
  return parsed.success ? parsed.data : defaultMoneyPrefs;
}

export async function setMoneyPrefs(db: Db, prefs: MoneyPrefs): Promise<void> {
  await writeAppSetting(db, KEY, moneyPrefsSchema.parse(prefs));
}
