import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { currencySymbol, formatAmountTyping } from '@/modules/finance';
import { useTheme } from '@/shared/theme';
import { AppText } from '@/shared/ui';

type Props = {
  /** Ce qui a été tapé sur le pavé (« 2500 », « 12,5 »), vide au départ. */
  digits: string;
  currency: string;
  /** Entrée d'argent : le montant prend la couleur « reçu » ; une dépense reste en texte. */
  income: boolean;
  /** Petit écran ou grand texte : un cran plus petit. */
  compact: boolean;
  error?: string | null;
};

/**
 * Le montant, en haut de l'écran et au centre de l'attention : groupé par milliers à mesure qu'on
 * tape (« 2 500 »), suivi de la monnaie. Vide, il montre un « 0 » estompé. Il rétrécit pour tenir
 * sur une ligne et suit la taille du texte (plafonnée, comme les grands chiffres). Le lecteur
 * d'écran l'annonce d'un bloc (« Montant : 2 500 FCFA »).
 */
export function AmountDisplay({ digits, currency, income, compact, error }: Props) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const empty = digits === '';
  const value = formatAmountTyping(digits);
  const symbol = currencySymbol(currency);
  return (
    <View style={{ alignItems: 'center', gap: spacing.xs }}>
      <View
        accessible
        accessibilityLabel={t('money.amountLabel', { amount: `${value} ${symbol}` })}
        accessibilityLiveRegion="polite"
        testID="amount-display"
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'center',
          gap: spacing.sm,
          maxWidth: '100%',
        }}
      >
        <AppText
          variant={compact ? 'display' : 'numeral'}
          color={empty ? 'muted' : income ? 'success' : 'text'}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          style={{ flexShrink: 1, fontVariant: ['tabular-nums'] }}
        >
          {value}
        </AppText>
        <AppText variant={compact ? 'heading' : 'headline'} color="muted">
          {symbol}
        </AppText>
      </View>
      {error ? (
        <AppText color="danger" style={{ textAlign: 'center' }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
