import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { formatMoney, setLoanClosed } from '@/modules/finance';
import { useMoneyData } from '@/projections';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  Card,
  Chip,
  EmptyState,
  LoadingScreen,
  SectionHeader,
  showError,
  TextButton,
} from '@/shared/ui';

/** Prêts : l'argent prêté (on me doit) et emprunté (je dois), et ce qui reste à rendre. */
export default function LoansScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { spacing } = useTheme();
  const data = useMoneyData(0);
  if (!data.data) return <LoadingScreen />;
  const loans = data.data.overview.loans;
  const today = data.data.input.today;

  const section = (direction: 'lent' | 'borrowed') => {
    const list = loans.filter((l) => l.loan.direction === direction);
    const open = list.filter((l) => !l.loan.closed && l.outstandingMinor > 0);
    const total = open.reduce((s, l) => s + l.outstandingMinor, 0);
    return (
      <View style={{ gap: spacing.sm }}>
        <SectionHeader
          title={
            direction === 'lent'
              ? t('money.owedToMe', {
                  amount: formatMoney(total, data.data?.overview.currency ?? 'XAF'),
                })
              : t('money.iOwe', {
                  amount: formatMoney(total, data.data?.overview.currency ?? 'XAF'),
                })
          }
        />
        {list.length === 0 ? <AppText color="muted">{t('money.noLoans')}</AppText> : null}
        {list.map(({ loan, outstandingMinor, totalMinor }) => {
          const done = loan.closed || outstandingMinor <= 0;
          const late = !done && loan.dueDate !== null && loan.dueDate < today;
          const cur = data.data?.overview.currency ?? 'XAF';
          return (
            <Card key={loan.id}>
              <View style={{ gap: spacing.xs }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <AppText variant="heading" style={{ flex: 1 }}>
                    {loan.person}
                  </AppText>
                  {done ? (
                    <Chip label={t('money.loanDone')} tone="success" />
                  ) : late ? (
                    <Chip label={t('money.late')} tone="danger" />
                  ) : null}
                </View>
                <AppText>
                  {t('money.loanLine', {
                    left: formatMoney(outstandingMinor, cur),
                    total: formatMoney(totalMinor, cur),
                  })}
                </AppText>
                {loan.dueDate ? (
                  <AppText variant="caption" color="muted">
                    {t('money.loanDue', { date: formatShortDate(loan.dueDate, labels.lang) })}
                  </AppText>
                ) : null}
                {loan.note ? (
                  <AppText variant="caption" color="muted">
                    {loan.note}
                  </AppText>
                ) : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                  {!done ? (
                    <TextButton
                      label={direction === 'lent' ? t('money.gotBack') : t('money.paidBack')}
                      onPress={() =>
                        router.push({
                          pathname: '/money/add',
                          params: {
                            kind: direction === 'lent' ? 'lend_back' : 'borrow_back',
                            loanId: loan.id,
                          },
                        })
                      }
                    />
                  ) : null}
                  <TextButton
                    label={loan.closed ? t('money.reopen') : t('money.close')}
                    onPress={() =>
                      setLoanClosed(db, loan.id, !loan.closed).catch((e: unknown) =>
                        showError(userMessageKey(e)),
                      )
                    }
                  />
                  <TextButton
                    label={t('common.edit')}
                    onPress={() =>
                      router.push({ pathname: '/money/loan-form', params: { id: loan.id } })
                    }
                  />
                </View>
              </View>
            </Card>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('money.loansTitle') }} />
      {loans.length === 0 ? (
        <EmptyState icon="users" title={t('money.noLoansTitle')} message={t('money.noLoansHint')} />
      ) : null}
      {section('lent')}
      {section('borrowed')}
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label={t('money.iLent')}
            onPress={() =>
              router.push({ pathname: '/money/loan-form', params: { direction: 'lent' } })
            }
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            variant="secondary"
            label={t('money.iBorrowed')}
            onPress={() =>
              router.push({ pathname: '/money/loan-form', params: { direction: 'borrowed' } })
            }
          />
        </View>
      </View>
    </ScrollView>
  );
}
