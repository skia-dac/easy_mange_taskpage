import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { CategoryBadge } from '@/components/money/CategoryBadge';
import { DueList } from '@/components/money/DueList';
import { MoneyHero } from '@/components/money/MoneyHero';
import { MoneyTiles } from '@/components/money/MoneyTiles';
import { PeriodNav } from '@/components/money/PeriodNav';
import { TransactionRow } from '@/components/money/TransactionRow';
import { useMoneyLabels } from '@/components/money/useMoneyLabels';
import { ProfileButton } from '@/components/ProfileButton';
import { HeaderButton } from '@/components/SearchButton';
import { useLabels } from '@/hooks/useLabels';
import { formatMoney } from '@/modules/finance';
import { useMoneyData } from '@/projections';
import { toIsoDate } from '@/shared/dates';
import { formatShortDate } from '@/shared/format';
import {
  Card,
  EmptyState,
  Fab,
  IconBadge,
  ListRow,
  loadStateOf,
  RiseIn,
  Screen,
  SectionHeader,
  StateView,
} from '@/shared/ui';

/** Onglet Argent : ce qu'il te reste, ce qui est à payer, tes dernières opérations. */
export default function MoneyScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const [offset, setOffset] = useState(0);
  const data = useMoneyData(offset);
  const money = useMoneyLabels(data.data?.input.categories ?? []);

  const state = loadStateOf(data);
  if (state !== 'ready' || !data.data) {
    // Chargement (lignes fantômes) ou échec (message et « Réessayer ») sous le titre de l'onglet.
    return (
      <View style={{ flex: 1 }}>
        <Screen title={t('money.title')} actions={<ProfileButton />}>
          <StateView state={state === 'error' ? 'error' : 'loading'} onRetry={data.retry} />
        </Screen>
      </View>
    );
  }
  const { overview: o, input } = data.data;
  const fmt = (v: number) => formatMoney(v, o.currency);
  const today = toIsoDate(new Date());
  const current = offset === 0;
  // Rien du tout (ni opération, ni report) : on guide le premier pas, sous la carte principale.
  // Une autre période vide dit seulement qu'il n'y a rien (plus bas, « Dernières opérations »).
  const empty = current && o.items.length === 0 && o.carryOver === 0;

  return (
    <View style={{ flex: 1 }}>
      <Screen
        stagger
        fab
        title={t('money.title')}
        actions={
          <>
            {/* Deux accès directs, chacun son icône et son libellé lu ; ils ne se cachent pas dans un menu. */}
            <HeaderButton icon="pie-chart" label={t('money.report')} href="/money/report" />
            <HeaderButton icon="settings" label={t('money.settings')} href="/money/settings" />
            <ProfileButton />
          </>
        }
      >
        <RiseIn>
          <PeriodNav
            range={o.range}
            period={input.period}
            offset={offset}
            onChange={setOffset}
            lang={labels.lang}
            today={today}
          />
        </RiseIn>

        <RiseIn>
          <MoneyHero overview={o} today={today} />
        </RiseIn>

        {empty ? (
          <EmptyState
            icon="credit-card"
            title={t('money.emptyTitle')}
            message={t('money.emptyHint')}
          />
        ) : null}

        <MoneyTiles overview={o} offset={offset} />

        <RiseIn>
          <SectionHeader
            title={
              o.unpaidTotal > 0
                ? t('money.dueTitleAmount', { amount: fmt(o.unpaidTotal) })
                : t('money.dueTitle')
            }
            action={{ label: t('money.manage'), onPress: () => router.push('/money/recurring') }}
          />
        </RiseIn>
        {o.due.length === 0 ? (
          <RiseIn>
            <Card>
              <ListRow
                title={t('money.addRecurring')}
                subtitle={t('money.addRecurringHint')}
                leading={<IconBadge icon="repeat" />}
                onPress={() => router.push('/money/recurring-form')}
              />
            </Card>
          </RiseIn>
        ) : (
          <DueList overview={o} input={input} current={current} today={today} lang={labels.lang} />
        )}

        {o.tontines.some((x) => x.payoutDate) ? (
          <Card>
            {o.tontines
              .filter((x) => x.payoutDate)
              .map((x) => (
                <RiseIn row key={x.recurring.id}>
                  <ListRow
                    title={t('money.myTurn', { name: x.recurring.name })}
                    subtitle={t('money.myTurnHint', {
                      date: formatShortDate(x.payoutDate ?? '', labels.lang),
                      amount: fmt(x.recurring.payoutMinor ?? 0),
                    })}
                    leading={<CategoryBadge category={money.categoryOf('tontine_in')} />}
                    onPress={() =>
                      router.push({
                        pathname: '/money/recurring-form',
                        params: { id: x.recurring.id },
                      })
                    }
                  />
                </RiseIn>
              ))}
          </Card>
        ) : null}

        {/* Premier pas : la carte « Commence par… » ci-dessus suffit, pas de second état vide. */}
        {empty ? null : (
          <>
            <RiseIn>
              <SectionHeader
                title={t('money.recent')}
                action={
                  o.items.length > 0
                    ? {
                        label: t('common.seeAll'),
                        onPress: () =>
                          router.push({
                            pathname: '/money/history',
                            params: { offset: String(offset) },
                          }),
                      }
                    : undefined
                }
              />
            </RiseIn>
            {o.items.length === 0 ? (
              // Les boutons « − Dépense » / « + Entrée » de la carte principale suffisent : on y renvoie.
              <EmptyState
                icon="list"
                title={t('money.noItems')}
                message={current ? t('money.noItemsHint') : t('money.noItemsHintOther')}
              />
            ) : (
              <Card>
                {o.items.slice(0, 8).map((item) => (
                  <RiseIn row key={item.id}>
                    <TransactionRow
                      item={item}
                      categories={input.categories}
                      lang={labels.lang}
                      showDate
                    />
                  </RiseIn>
                ))}
              </Card>
            )}
          </>
        )}
      </Screen>
      <Fab accessibilityLabel={t('money.addExpense')} onPress={() => router.push('/money/add')} />
    </View>
  );
}
