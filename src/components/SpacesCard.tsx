import Feather from '@expo/vector-icons/Feather';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Switch, View } from 'react-native';

import {
  DEFAULT_WORK_WEEK_HOURS,
  getWorkWeekHours,
  setActiveSpaces,
  setWorkWeekHours,
  workWeekHourChoices,
} from '@/modules/identity';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { useSpaces } from '@/shared/SpacesContext';
import { spaceIds, toggleSpace, type SpaceId } from '@/shared/spaces';
import { useTheme } from '@/shared/theme';
import { AppText, Card, ChoiceSheet, confirmAction, showError } from '@/shared/ui';

import { spaceColor } from './SpaceUi';

const ICONS: Record<SpaceId, ComponentProps<typeof Feather>['name']> = {
  study: 'book-open',
  work: 'briefcase',
  personal: 'home',
};

/**
 * « Mes espaces » (Profil) : Études, Pro et Perso s'activent séparément ; le dernier actif
 * est bloqué. Couper un espace le cache seulement : ses données restent intactes.
 */
export function SpacesCard() {
  const { t } = useTranslation();
  const db = useDb();
  const { colors, radius, spacing, scheme } = useTheme();
  const { active, has } = useSpaces();
  const hoursQ = useLiveQuery(getWorkWeekHours, ['app_settings'], []);
  const hours = hoursQ.data ?? DEFAULT_WORK_WEEK_HOURS;
  const [pickHours, setPickHours] = useState(false);

  const change = async (id: SpaceId, on: boolean) => {
    const next = toggleSpace(active, id, on);
    if (next === active) return;
    if (!on) {
      const ok = await confirmAction(
        t('spaces.offTitle', { name: t(`spaces.name.${id}`) }),
        t(`spaces.offMessage.${id}`),
        t('spaces.offConfirm'),
      );
      if (!ok) return;
    }
    try {
      await setActiveSpaces(db, next);
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  return (
    <Card>
      {spaceIds.map((id, i) => {
        const on = has(id);
        const locked = on && active.length === 1;
        const c = spaceColor(id);
        return (
          <View
            key={id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.md,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.border,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.sm,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: on ? (scheme === 'dark' ? c.softDark : c.soft) : colors.background,
              }}
            >
              <Feather
                name={ICONS[id]}
                size={20}
                color={on ? (scheme === 'dark' ? c.strongDark : c.strong) : colors.muted}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">{t(`spaces.name.${id}`)}</AppText>
              <AppText variant="caption" color="muted">
                {t(`spaces.hint.${id}`)}
              </AppText>
              {locked ? (
                <AppText variant="caption" color="warning">
                  {t('spaces.lastOne')}
                </AppText>
              ) : null}
              {id === 'work' && on ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPickHours(true)}
                  hitSlop={8}
                >
                  <AppText variant="caption" color="primary">
                    {t('spaces.workHours', { hours })}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
            <Switch
              accessibilityLabel={t(`spaces.name.${id}`)}
              accessibilityHint={locked ? t('spaces.lastOne') : undefined}
              value={on}
              disabled={locked}
              onValueChange={(v) => void change(id, v)}
              trackColor={{ true: colors.success, false: colors.border }}
            />
          </View>
        );
      })}
      <ChoiceSheet
        visible={pickHours}
        title={t('spaces.workHoursTitle')}
        message={t('spaces.workHoursHint')}
        options={workWeekHourChoices.map((h) => ({
          label: t('spaces.hoursValue', { hours: h }),
          onPress: () => {
            setPickHours(false);
            setWorkWeekHours(db, h).catch((e: unknown) => showError(userMessageKey(e)));
          },
        }))}
        onClose={() => setPickHours(false)}
      />
    </Card>
  );
}
