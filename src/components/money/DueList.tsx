import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { formatMoney, payDue, unpayDue, type DueItem } from '@/modules/finance';
import {
  dueKey,
  forgetPaidLate,
  groupDue,
  rememberPaidLate,
  type DueGroup,
  type MoneyInput,
  type MoneyOverview,
} from '@/projections';
import type { IsoDate } from '@/shared/dates';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { formatShortDate } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Card,
  Checkbox,
  Chip,
  ListRow,
  RiseIn,
  showError,
  showUndoToast,
  TextButton,
} from '@/shared/ui';

/** Lignes montrées dans « À payer » ; les autres sont à un appui (« Voir tout »). */
export const DUE_LIMIT = 6;

type Props = {
  overview: MoneyOverview;
  input: MoneyInput;
  /** La période affichée est celle en cours. */
  current: boolean;
  today: IsoDate;
  lang: string;
};

/**
 * « À payer » : une ligne par charge fixe ou tontine (les 5 cotisations d'une tontine de la
 * semaine tiennent sur une ligne). La case paie la prochaine échéance ; quand tout est payé, elle
 * annule le dernier paiement. Chaque geste a son « Annuler ».
 */
export function DueList({ overview: o, input, current, today, lang }: Props) {
  const { t } = useTranslation();
  const db = useDb();
  const { spacing } = useTheme();
  const cur = o.currency;
  const groups = groupDue(o.due, today);
  const shown = groups.slice(0, DUE_LIMIT);

  const pay = (d: DueItem) => {
    // Une échéance en retard payée reste visible (cochée) dans la période, pour pouvoir la décocher.
    const late = current && d.date < input.range.from;
    if (late) rememberPaidLate(input.range.from, dueKey(d));
    payDue(db, d.recurring.id, d.date, current ? today : d.date).then(
      () =>
        showUndoToast({ title: t('money.paidToast'), detail: d.recurring.name }, () =>
          unpayDue(db, d.recurring.id, d.date),
        ),
      (e: unknown) => {
        if (late) forgetPaidLate(input.range.from, dueKey(d));
        showError(userMessageKey(e));
      },
    );
  };

  const unpay = (d: DueItem) => {
    // Décocher supprime la dépense : « Annuler » la recrée telle quelle (même date, même montant).
    const paidTx = input.transactions.find((x) => x.id === d.transactionId);
    unpayDue(db, d.recurring.id, d.date).then(
      () =>
        showUndoToast(
          { title: t('money.unpaidToast'), detail: d.recurring.name },
          () => payDue(db, d.recurring.id, d.date, paidTx?.date ?? d.date, paidTx?.amountMinor),
          { tone: 'info' },
        ),
      (e: unknown) => showError(userMessageKey(e)),
    );
  };

  const toggle = (g: DueGroup) => {
    if (g.next) pay(g.next);
    else if (g.lastPaid) unpay(g.lastPaid);
  };

  const row = (g: DueGroup) => {
    const name = g.recurring.name;
    const many = g.count > 1;
    const done = g.next === null;
    const shownDate = (g.next ?? g.lastPaid)?.date;
    const progress = many ? t('money.duePaidOf', { paid: g.paidCount, total: g.count }) : null;
    const subtitle = many
      ? [
          t('money.dueCount', {
            times: g.count,
            amount: formatMoney(g.recurring.amountMinor, cur, { symbol: false }),
          }),
          g.next ? t('money.dueNext', { date: formatShortDate(g.next.date, lang) }) : null,
          // En retard, la place sous le montant est prise par l'étiquette : l'avancée passe ici.
          g.late && g.paidCount > 0 ? progress : null,
        ]
      : [
          g.recurring.kind === 'tontine' ? t('money.tontine') : null,
          shownDate ? formatShortDate(shownDate, lang) : null,
          g.recurring.time,
        ];
    const status = done && !many ? t('money.paid') : null;
    return (
      <RiseIn row key={g.recurring.id}>
        <ListRow
          title={name}
          titleLines={1}
          struck={done}
          subtitle={subtitle.filter(Boolean).join(' · ')}
          control={
            <Checkbox
              checked={done}
              accessibilityLabel={t('money.markPaid', { name })}
              onToggle={() => toggle(g)}
            />
          }
          trailing={
            <View style={{ alignItems: 'flex-end', gap: spacing.xxs }}>
              <AppText variant="bodyStrong">
                {formatMoney(g.totalMinor, cur, { symbol: false })}
              </AppText>
              {g.late ? (
                <Chip label={t('money.late')} tone="danger" />
              ) : progress ? (
                <AppText variant="caption" color={done ? 'success' : 'muted'}>
                  {progress}
                </AppText>
              ) : status ? (
                <AppText variant="caption" color="success">
                  {status}
                </AppText>
              ) : null}
            </View>
          }
          trailingLabel={[
            formatMoney(g.totalMinor, cur),
            g.late ? t('money.late') : (progress ?? status),
          ]
            .filter(Boolean)
            .join(', ')}
          chevron={false}
          onPress={() =>
            router.push({ pathname: '/money/recurring-form', params: { id: g.recurring.id } })
          }
        />
      </RiseIn>
    );
  };

  return (
    <Card>
      {shown.map(row)}
      {groups.length > shown.length ? (
        <TextButton
          label={t('money.dueSeeAll', { more: groups.length - shown.length })}
          onPress={() => router.push('/money/recurring')}
        />
      ) : null}
    </Card>
  );
}
