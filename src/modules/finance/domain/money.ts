import { MONEY_MAX_MINOR } from '@/shared/fieldLimits';

/**
 * Montants : toujours des entiers dans la plus petite unité de la monnaie (FCFA : le franc,
 * euro : le centime). Jamais de nombres à virgule pour de l'argent.
 */
export const currencies = {
  XAF: { symbol: 'FCFA', decimals: 0 },
  XOF: { symbol: 'FCFA', decimals: 0 },
  EUR: { symbol: '€', decimals: 2 },
  USD: { symbol: '$', decimals: 2 },
  GBP: { symbol: '£', decimals: 2 },
  CAD: { symbol: '$ CA', decimals: 2 },
  NGN: { symbol: '₦', decimals: 2 },
  GHS: { symbol: 'GH₵', decimals: 2 },
  MAD: { symbol: 'DH', decimals: 2 },
  CNY: { symbol: '¥', decimals: 2 },
} as const;

export type CurrencyCode = keyof typeof currencies;
export const currencyCodes = Object.keys(currencies) as CurrencyCode[];
export const DEFAULT_CURRENCY: CurrencyCode = 'XAF';

export function isCurrency(code: string): code is CurrencyCode {
  return code in currencies;
}

const decimalsOf = (code: string) => (isCurrency(code) ? currencies[code].decimals : 2);

/** Symbole affiché d'une monnaie (« FCFA », « € ») ; son code si elle est inconnue. */
export const currencySymbol = (code: string) => (isCurrency(code) ? currencies[code].symbol : code);

/** Chiffres groupés par milliers avec une espace simple (« 12 500 »). */
const groupThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** « 12 500 FCFA », « 12,50 € » (séparateur de milliers : espace simple, lisible partout). */
export function formatMoney(
  minor: number,
  currency: string,
  options: { signed?: boolean; symbol?: boolean } = {},
): string {
  const d = decimalsOf(currency);
  const abs = Math.abs(Math.round(minor));
  const units = Math.floor(abs / 10 ** d);
  const cents = abs % 10 ** d;
  const grouped = groupThousands(String(units));
  const number = d > 0 ? `${grouped},${String(cents).padStart(d, '0')}` : grouped;
  const sign = minor < 0 ? '−' : options.signed && minor > 0 ? '+' : '';
  const symbol = options.symbol === false ? '' : ` ${currencySymbol(currency)}`;
  return `${sign}${number}${symbol}`;
}

/**
 * Texte saisi → montant en plus petite unité. « 12 500 », « 12,5 », « 12.50 » acceptés.
 * Retourne null si ce n'est pas un montant positif valide.
 */
export function parseAmount(text: string, currency: string): number | null {
  const d = decimalsOf(currency);
  const clean = text.replace(/[\s  ]/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const [int, frac = ''] = clean.split('.') as [string, string?];
  if (frac.length > d) return null;
  const minor = Number(int) * 10 ** d + Number((frac ?? '').padEnd(d, '0') || '0');
  return Number.isSafeInteger(minor) && minor > 0 && minor <= MONEY_MAX_MINOR ? minor : null;
}

/** Montant en plus petite unité → texte modifiable dans un champ (« 12500 », « 12,50 »). */
export function amountInput(minor: number, currency: string): string {
  const d = decimalsOf(currency);
  if (d === 0) return String(minor);
  return `${Math.floor(minor / 10 ** d)},${String(minor % 10 ** d).padStart(d, '0')}`;
}

/**
 * Montant en cours de saisie sur le pavé (« 12500 », « 12, », « 12,5 ») → texte affiché, groupé
 * par milliers comme `formatMoney` mais sans symbole et sans compléter les décimales pas encore
 * tapées (« 12 500 », « 12, », « 12,5 »). Vide → « 0 ».
 */
export function formatAmountTyping(text: string): string {
  const [int = '', frac] = text.split(',');
  const units = int.replace(/\D/g, '').replace(/^0+(?=\d)/, '') || '0';
  return frac === undefined ? groupThousands(units) : `${groupThousands(units)},${frac}`;
}
