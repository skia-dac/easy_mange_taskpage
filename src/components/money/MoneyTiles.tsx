import type Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { formatMoney } from '@/modules/finance';
import type { MoneyOverview } from '@/projections';
import { useTheme, type ColorTokens } from '@/shared/theme';
import { AppText, Card, CountUpText, IconBadge, RiseIn, Tappable, useLargeText } from '@/shared/ui';

type Tone = { color: keyof ColorTokens; background: keyof ColorTokens };

type TileProps = {
  icon: ComponentProps<typeof Feather>['name'];
  tone: Tone;
  label: string;
  children: ReactNode;
  onPress: () => void;
};

function Tile({ icon, tone, label, children, onPress }: TileProps) {
  const { spacing } = useTheme();
  return (
    <Tappable accessibilityRole="button" onPress={onPress} style={{ flexGrow: 1 }}>
      <Card style={{ flexGrow: 1, gap: spacing.xs }}>
        {/* Icône et libellé sur une ligne, montant dessous : les 4 tuiles s'alignent. */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <IconBadge icon={icon} size={28} color={tone.color} background={tone.background} />
          <AppText variant="caption" color="muted" style={{ flex: 1 }}>
            {label}
          </AppText>
        </View>
        {children}
      </Card>
    </Tappable>
  );
}

/** Entrées, Dépenses, Épargne, On me doit : quatre tuiles qui ouvrent leur écran. */
export function MoneyTiles({ overview: o, offset }: { overview: MoneyOverview; offset: number }) {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  // Très grand texte : une tuile par ligne, rien n'est coupé.
  const width = useLargeText() ? '100%' : '48%';
  const cur = o.currency;
  const history = (filter: 'income' | 'expense') => () =>
    router.push({ pathname: '/money/history', params: { filter, offset: String(offset) } });
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
      <RiseIn style={{ width, flexGrow: 1 }}>
        <Tile
          icon="arrow-down-left"
          tone={{ color: 'success', background: 'successSoft' }}
          label={t('money.incomes')}
          onPress={history('income')}
        >
          <CountUpText
            variant="heading"
            color="success"
            value={o.income}
            format={(n) => formatMoney(n, cur, { signed: true })}
          />
        </Tile>
      </RiseIn>
      <RiseIn style={{ width, flexGrow: 1 }}>
        <Tile
          icon="arrow-up-right"
          tone={{ color: 'danger', background: 'dangerSoft' }}
          label={t('money.expenses')}
          onPress={history('expense')}
        >
          <CountUpText
            variant="heading"
            color="danger"
            value={-o.expense}
            format={(n) => formatMoney(n, cur)}
          />
        </Tile>
      </RiseIn>
      <RiseIn style={{ width, flexGrow: 1 }}>
        <Tile
          icon="target"
          tone={{ color: 'primary', background: 'primarySoft' }}
          label={t('money.savings')}
          onPress={() => router.push('/money/goals')}
        >
          <CountUpText
            variant="heading"
            value={o.savingsByCurrency.find((x) => x.currency === cur)?.savedMinor ?? 0}
            format={(n) => formatMoney(n, cur)}
          />
          {o.savingsByCurrency
            .filter((x) => x.currency !== cur && x.savedMinor > 0)
            .map((x) => (
              <AppText key={x.currency} variant="caption" color="muted">
                + {formatMoney(x.savedMinor, x.currency)}
              </AppText>
            ))}
        </Tile>
      </RiseIn>
      <RiseIn style={{ width, flexGrow: 1 }}>
        <Tile
          icon="users"
          tone={{ color: 'warning', background: 'warningSoft' }}
          label={t('money.loans')}
          onPress={() => router.push('/money/loans')}
        >
          <CountUpText
            variant="heading"
            color="warning"
            value={o.loanTotals.owedToMeMinor}
            format={(n) => formatMoney(n, cur)}
          />
          {o.loanTotals.iOweMinor > 0 ? (
            <AppText variant="caption" color="muted">
              {t('money.iOwe', { amount: formatMoney(o.loanTotals.iOweMinor, cur) })}
            </AppText>
          ) : null}
        </Tile>
      </RiseIn>
    </View>
  );
}
