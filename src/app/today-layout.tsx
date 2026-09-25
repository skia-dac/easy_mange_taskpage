import Feather from '@expo/vector-icons/Feather';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import {
  getTodayLayout,
  normalizeTodayLayout,
  setTodayLayout,
  type TodayLayout,
  type TodaySectionId,
} from '@/modules/identity';
import { useSpaces } from '@/shared/SpacesContext';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { minTouchSize, useTheme } from '@/shared/theme';
import { AppText, Card, confirmAction, showError, TextButton } from '@/shared/ui';

/** L'étudiant choisit l'ordre des sections d'Aujourd'hui et celles qu'il veut voir. */
const STUDY_SECTIONS: readonly TodaySectionId[] = ['next', 'courses', 'revision', 'exams'];
const PERSONAL_SECTIONS: readonly TodaySectionId[] = ['money', 'habits'];

export default function TodayLayoutScreen() {
  const spaces = useSpaces();
  const sectionAvailable = (id: TodaySectionId) =>
    STUDY_SECTIONS.includes(id)
      ? spaces.has('study')
      : PERSONAL_SECTIONS.includes(id)
        ? spaces.has('personal')
        : true;
  const { t } = useTranslation();
  const db = useDb();
  const { colors, spacing } = useTheme();
  const query = useLiveQuery(getTodayLayout, ['app_settings'], []);
  const layout = query.data ?? normalizeTodayLayout(null);

  const save = (next: TodayLayout) =>
    setTodayLayout(db, next).catch((e: unknown) => showError(userMessageKey(e)));

  const move = (id: TodaySectionId, dir: -1 | 1) => {
    const order = [...layout.order];
    const i = order.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j] as TodaySectionId, order[i] as TodaySectionId];
    void save({ ...layout, order });
  };

  const setVisible = (id: TodaySectionId, visible: boolean) =>
    void save({
      ...layout,
      hidden: visible ? layout.hidden.filter((h) => h !== id) : [...layout.hidden, id],
    });

  const arrow = (id: TodaySectionId, dir: -1 | 1, enabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir === -1 ? t('subtasks.up') : t('subtasks.down')}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      onPress={() => move(id, dir)}
      style={{ width: 36, height: minTouchSize, alignItems: 'center', justifyContent: 'center' }}
    >
      <Feather
        name={dir === -1 ? 'arrow-up' : 'arrow-down'}
        size={20}
        color={enabled ? colors.primary : colors.border}
      />
    </Pressable>
  );

  const reset = async () => {
    const ok = await confirmAction(
      t('todayLayout.resetTitle'),
      t('todayLayout.resetMessage'),
      t('todayLayout.resetConfirm'),
    );
    if (ok) await save(normalizeTodayLayout(null));
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('todayLayout.title') }} />
      <AppText color="muted">{t('todayLayout.intro')}</AppText>
      <Card>
        {layout.order.map((id, i) => {
          // Sections d'un espace coupé : pas proposées (leur place dans l'ordre est gardée).
          if (!sectionAvailable(id)) return null;
          const visible = !layout.hidden.includes(id);
          return (
            <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <AppText variant="bodyStrong" color={visible ? 'text' : 'muted'} style={{ flex: 1 }}>
                {t(`todayLayout.sections.${id}`)}
              </AppText>
              {arrow(id, -1, i > 0)}
              {arrow(id, 1, i < layout.order.length - 1)}
              <Switch
                accessibilityLabel={t('todayLayout.show', {
                  name: t(`todayLayout.sections.${id}`),
                })}
                value={visible}
                onValueChange={(v) => setVisible(id, v)}
                trackColor={{ true: colors.success, false: colors.border }}
              />
            </View>
          );
        })}
      </Card>
      <TextButton label={t('todayLayout.reset')} onPress={() => void reset()} />
    </ScrollView>
  );
}
