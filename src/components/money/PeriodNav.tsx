import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import type { BudgetPeriod, PeriodRange } from '@/modules/finance';
import { periodLabel } from '@/projections';
import type { IsoDate } from '@/shared/dates';
import { formatShortDate } from '@/shared/format';
import { minTouchSize, useTheme } from '@/shared/theme';
import { AppText, Tappable } from '@/shared/ui';

type Props = {
  range: PeriodRange;
  period: BudgetPeriod;
  /** 0 = période en cours, −1 = la précédente… */
  offset: number;
  onChange: (offset: number) => void;
  lang: string;
  today: IsoDate;
};

/**
 * ‹ Janvier 2027 › : flèches vers la période d'avant / d'après. Hors de la période en cours, une
 * pastille « Aujourd'hui » y ramène (toucher le libellé le fait aussi). Le lecteur d'écran lit
 * le libellé court ET les dates exactes.
 */
export function PeriodNav({ range, period, offset, onChange, lang, today }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const label = periodLabel(range, period, lang, today, (from, to) =>
    t('money.periodCompact', { from, to }),
  );
  const exact = t('money.periodRange', {
    from: formatShortDate(range.from, lang),
    to: formatShortDate(range.to, lang),
  });

  const arrow = (icon: 'chevron-left' | 'chevron-right', dir: -1 | 1) => (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={dir === -1 ? t('money.previous') : t('money.next')}
      onPress={() => onChange(offset + dir)}
      style={{
        width: minTouchSize,
        height: minTouchSize,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Feather name={icon} size={24} color={colors.primary} />
    </Tappable>
  );

  return (
    <View style={{ gap: spacing.xxs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        {arrow('chevron-left', -1)}
        <Tappable
          accessibilityRole="button"
          accessibilityLabel={t('money.periodLabel', { label, range: exact })}
          accessibilityHint={offset !== 0 ? t('money.backToCurrent') : undefined}
          onPress={() => onChange(0)}
          style={{
            flexShrink: 1,
            minHeight: minTouchSize,
            minWidth: minTouchSize,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing.sm,
          }}
        >
          <AppText variant="heading" style={{ textAlign: 'center' }}>
            {label}
          </AppText>
        </Tappable>
        {arrow('chevron-right', 1)}
      </View>
      {offset !== 0 ? (
        <Tappable
          accessibilityRole="button"
          accessibilityLabel={t('money.backToCurrentLabel')}
          onPress={() => onChange(0)}
          style={{ alignSelf: 'center', minHeight: minTouchSize, justifyContent: 'center' }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xs,
              backgroundColor: colors.primarySoft,
              borderRadius: radius.pill,
              paddingHorizontal: spacing.md,
              paddingVertical: spacing.xs,
            }}
          >
            <Feather name="rotate-ccw" size={14} color={colors.primary} />
            <AppText variant="caption" color="primary">
              {t('common.today')}
            </AppText>
          </View>
        </Tappable>
      ) : null}
    </View>
  );
}
