import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useLabels } from '@/hooks/useLabels';
import { attachmentExists, attachmentUri } from '@/modules/platform';
import { listCheckpoints, weightChange, type Checkpoint } from '@/modules/productivity';
import { useLiveQuery } from '@/shared/db';
import { formatShortDate, formatKg } from '@/shared/format';
import { useTheme } from '@/shared/theme';
import { AppText, Button, Card, ListRow, SectionHeader } from '@/shared/ui';

const kg = formatKg;

/**
 * « Ma progression physique » : photo et poids du départ, puis du dernier point, et l'écart.
 * Visible pour les habitudes avec le suivi physique (le sport, par exemple).
 */
export function BodyProgressCard({ habitId }: { habitId: string }) {
  const { t } = useTranslation();
  const labels = useLabels();
  const { colors, radius, spacing } = useTheme();
  const q = useLiveQuery((d) => listCheckpoints(d, habitId), ['habit_checkpoints'], [habitId]);
  const points = q.data ?? [];
  const start = points[0];
  const latest = points.length > 1 ? points[points.length - 1] : undefined;
  const change = weightChange(points);

  const add = () => router.push({ pathname: '/habits/checkpoint', params: { habitId } });
  const open = (c: Checkpoint) =>
    router.push({ pathname: '/habits/checkpoint', params: { habitId, id: c.id } });

  const photo = (c: Checkpoint | undefined, label: string) => (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <View
        style={{
          aspectRatio: 3 / 4,
          borderRadius: radius.md,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {c?.photoPath && attachmentExists(c.photoPath) ? (
          <Image
            accessibilityLabel={label}
            source={{ uri: attachmentUri(c.photoPath) }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : (
          <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
            {c?.photoPath ? t('bodyProgress.photoElsewhere') : t('bodyProgress.noPhoto')}
          </AppText>
        )}
      </View>
      <AppText variant="label" color="muted">
        {label.toLocaleUpperCase()}
      </AppText>
      {c ? (
        <AppText variant="bodyStrong">
          {c.weightKg !== null ? kg(c.weightKg, labels.lang) : '—'}
          <AppText variant="caption" color="muted">
            {`  ${formatShortDate(c.date, labels.lang)}`}
          </AppText>
        </AppText>
      ) : null}
    </View>
  );

  return (
    <>
      <SectionHeader title={t('bodyProgress.title')} />
      <Card>
        {!start ? (
          <View style={{ gap: spacing.md }}>
            <AppText color="muted">{t('bodyProgress.emptyHint')}</AppText>
            <Button label={t('bodyProgress.startButton')} onPress={add} />
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              {photo(start, t('bodyProgress.start'))}
              {photo(latest, t('bodyProgress.now'))}
            </View>
            {change ? (
              <AppText variant="bodyStrong" color="primary">
                {t('bodyProgress.change', {
                  delta: `${change.deltaKg > 0 ? '+' : change.deltaKg < 0 ? '−' : ''}${kg(Math.abs(change.deltaKg), labels.lang)}`,
                  date: formatShortDate(change.start.date, labels.lang),
                })}
              </AppText>
            ) : null}
            <Button variant="secondary" label={t('bodyProgress.addButton')} onPress={add} />
          </View>
        )}
      </Card>
      {points.length > 0 ? (
        <Card>
          {[...points].reverse().map((c, i) => (
            <ListRow
              key={c.id}
              title={formatShortDate(c.date, labels.lang)}
              subtitle={[
                c.weightKg !== null ? kg(c.weightKg, labels.lang) : null,
                c.photoPath ? t('bodyProgress.withPhoto') : null,
                i === points.length - 1 ? t('bodyProgress.start') : null,
              ]
                .filter(Boolean)
                .join(' · ')}
              onPress={() => open(c)}
            />
          ))}
        </Card>
      ) : null}
    </>
  );
}
