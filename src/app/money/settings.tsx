import Feather from '@expo/vector-icons/Feather';
import { Stack } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import { CategoryBadge } from '@/components/money/CategoryBadge';
import { useMoneyLabels } from '@/components/money/useMoneyLabels';
import { useLabels } from '@/hooks/useLabels';
import {
  categoryIcons,
  createCategory,
  currencies,
  currencyCodes,
  defaultMoneyPrefs,
  deleteCategory,
  getMoneyPrefs,
  listCategories,
  setMoneyPrefs,
  type CategoryKind,
  type MoneyPrefs,
} from '@/modules/finance';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { isValidationError } from '@/shared/validation';
import { minTouchSize, subjectColors, useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  Card,
  ChoiceChips,
  confirmDestructive,
  ListRow,
  SectionHeader,
  Segmented,
  SelectField,
  showError,
  TextField,
  fieldLimits,
  KeyboardAvoiding,
} from '@/shared/ui';

/** Réglages de l'argent : monnaie, début du mois ou de la semaine, widgets, catégories personnelles. */
export default function MoneySettingsScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { colors, spacing, radius, scheme } = useTheme();
  const prefsQ = useLiveQuery(getMoneyPrefs, ['app_settings'], []);
  const prefs = prefsQ.data ?? defaultMoneyPrefs;
  const cats = useLiveQuery(listCategories, ['money_categories'], []);
  const money = useMoneyLabels(cats.data ?? []);
  const [kind, setKind] = useState<CategoryKind>('expense');
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string>('tag');
  const [colorId, setColorId] = useState('slate');
  const [nameError, setNameError] = useState<string | undefined>();
  const fail = (e: unknown) => showError(userMessageKey(e));

  const save = (patch: Partial<MoneyPrefs>) =>
    setMoneyPrefs(db, { ...prefs, ...patch }).catch(fail);
  const period = prefs.period;

  const add = () => {
    if (!name.trim()) {
      setNameError('validation.required');
      return;
    }
    createCategory(db, { kind, name, icon, colorId }).then(
      () => {
        setName('');
        setNameError(undefined);
      },
      // Erreur de saisie (ex. nom trop long) sous le champ, le reste en message.
      (e: unknown) => (isValidationError(e) ? setNameError(e.fields.name) : fail(e)),
    );
  };

  const remove = async (id: string, label: string) => {
    const ok = await confirmDestructive(
      t('money.deleteCategoryTitle', { name: label }),
      t('money.deleteCategoryMessage'),
      t('common.delete'),
    );
    if (ok) deleteCategory(db, id).catch(fail);
  };

  return (
    <KeyboardAvoiding>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
      >
        <Stack.Screen options={{ title: t('money.settings') }} />

        <SectionHeader title={t('money.currency')} />
        <SelectField
          label={t('money.currency')}
          value={prefs.currency}
          options={currencyCodes.map((c) => ({
            value: c,
            label: `${t(`money.currencies.${c}`)} (${currencies[c].symbol})`,
          }))}
          onChange={(v) => v && void save({ currency: v as MoneyPrefs['currency'] })}
        />
        <AppText variant="caption" color="muted">
          {t('money.currencyHint')}
        </AppText>

        <SectionHeader title={t('money.periodTitle')} />
        <Segmented
          value={period.kind}
          onChange={(k) =>
            void save({
              period:
                k === 'month' ? { kind: 'month', startDay: 1 } : { kind: 'week', startWeekday: 1 },
            })
          }
          options={[
            { value: 'month', label: t('money.periodMonth') },
            { value: 'week', label: t('money.periodWeek') },
          ]}
        />
        {period.kind === 'month' ? (
          <SelectField
            label={t('money.periodStartDay')}
            value={String(period.startDay)}
            options={Array.from({ length: 31 }, (_, i) => ({
              value: String(i + 1),
              label: t('money.dayN', { day: i + 1 }),
            }))}
            onChange={(v) => void save({ period: { kind: 'month', startDay: Number(v ?? 1) } })}
          />
        ) : (
          <ChoiceChips
            label={t('money.periodStartWeekday')}
            options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({
              value: n,
              label: labels.weekday(n, 'short'),
            }))}
            selected={[period.startWeekday]}
            onToggle={(n) => void save({ period: { kind: 'week', startWeekday: n } })}
          />
        )}
        <AppText variant="caption" color="muted">
          {t('money.periodHint')}
        </AppText>

        <SectionHeader title={t('money.widgets')} />
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">{t('money.hideAmounts')}</AppText>
              <AppText variant="caption" color="muted">
                {t('money.hideAmountsHint')}
              </AppText>
            </View>
            <Switch
              accessibilityLabel={t('money.hideAmounts')}
              value={prefs.hideWidgetAmounts}
              onValueChange={(v) => void save({ hideWidgetAmounts: v })}
              trackColor={{ true: colors.success, false: colors.border }}
            />
          </View>
        </Card>

        <SectionHeader title={t('money.myCategories')} />
        {(cats.data ?? []).length > 0 ? (
          <Card>
            {(cats.data ?? []).map((c) => (
              <ListRow
                key={c.id}
                title={money.categoryName(c)}
                subtitle={c.kind === 'income' ? t('money.income') : t('money.expense')}
                leading={<CategoryBadge category={c} />}
                trailing={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('common.delete')}
                    hitSlop={10}
                    onPress={() => void remove(c.id, money.categoryName(c))}
                  >
                    <Feather name="trash-2" size={20} color={colors.danger} />
                  </Pressable>
                }
              />
            ))}
          </Card>
        ) : (
          <AppText color="muted">{t('money.noCustomCategories')}</AppText>
        )}
        <Card>
          <View style={{ gap: spacing.md }}>
            <AppText variant="bodyStrong">{t('money.newCategory')}</AppText>
            <Segmented
              value={kind}
              onChange={setKind}
              options={[
                { value: 'expense', label: t('money.expense') },
                { value: 'income', label: t('money.income') },
              ]}
            />
            <TextField
              label={t('money.categoryName')}
              required
              value={name}
              onChangeText={setName}
              error={nameError}
              limit={fieldLimits.category}
              placeholder={t('money.categoryPlaceholder')}
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {categoryIcons.map((i) => (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityState={{ selected: i === icon }}
                  accessibilityLabel={i}
                  onPress={() => setIcon(i)}
                  style={{
                    width: minTouchSize,
                    height: minTouchSize,
                    borderRadius: radius.md,
                    borderWidth: i === icon ? 2 : 1,
                    borderColor: i === icon ? colors.primary : colors.border,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Feather
                    name={i as ComponentProps<typeof Feather>['name']}
                    size={20}
                    color={colors.text}
                  />
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {subjectColors.map((c) => (
                <Pressable
                  key={c.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: c.id === colorId }}
                  accessibilityLabel={c.id}
                  onPress={() => setColorId(c.id)}
                  style={{
                    width: minTouchSize,
                    height: minTouchSize,
                    borderRadius: minTouchSize / 2,
                    backgroundColor: scheme === 'dark' ? c.strongDark : c.strong,
                    borderWidth: c.id === colorId ? 3 : 0,
                    borderColor: colors.text,
                  }}
                />
              ))}
            </View>
            <Button label={t('money.addCategory')} onPress={add} />
          </View>
        </Card>
      </ScrollView>
    </KeyboardAvoiding>
  );
}
