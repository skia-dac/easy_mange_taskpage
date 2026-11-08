import Feather from '@expo/vector-icons/Feather';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { goBack } from '@/components/navigation';
import { EditLoadView } from '@/components/EditLoadView';
import {
  CategoryColorRow,
  CategoryIconGrid,
  CategoryPreview,
} from '@/components/money/CategoryPickers';
import { useMoneyLabels } from '@/components/money/useMoneyLabels';
import { useEditLoad } from '@/hooks/useEditLoad';
import { useDirty, useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import {
  categoriesOf,
  categoryIcons,
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  normalizeCategoryName,
  suggestionsFor,
  updateCategory,
  type CategoryKind,
  type CategorySuggestion,
} from '@/modules/finance';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { subjectColors, useTheme } from '@/shared/theme';
import {
  AppText,
  ChoiceChip,
  confirmDestructive,
  FieldShell,
  FormScreen,
  Segmented,
  showError,
  TextButton,
  TextField,
  fieldLimits,
  useSave,
} from '@/shared/ui';

type Form = { kind: CategoryKind; name: string; icon: string; colorId: string };

/**
 * Créer (`?kind=` facultatif) ou modifier (`?id=`) une catégorie d'argent personnelle : aperçu en
 * direct, idées toutes prêtes, icône et couleur. Supprimer range ses opérations dans « Autre ».
 */
export default function MoneyCategoryFormScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { colors, scheme, spacing } = useTheme();
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const id = params.id;
  const [form, setForm] = useState<Form>({
    kind: params.kind === 'income' ? 'income' : 'expense',
    name: '',
    icon: 'tag',
    colorId: 'slate',
  });
  const { errors, saving, run } = useSave();
  const custom = useLiveQuery(listCategories, ['money_categories'], []);
  const money = useMoneyLabels(custom.data ?? []);

  // Modification : les champs n'apparaissent qu'une fois la catégorie lue (jamais écrasés).
  const load = useEditLoad(
    id,
    (categoryId) => getCategory(db, categoryId),
    (c) => setForm({ kind: c.kind, name: c.name ?? '', icon: c.icon, colorId: c.colorId }),
  );
  const { dirty } = useDirty(form, load.state === 'ready');
  const leave = useUnsavedGuard(dirty);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const suggestionName = (s: CategorySuggestion) => t(`money.suggestions.${s.id}`);
  // Idées seulement à la création, sans celles qui portent déjà le nom d'une catégorie.
  const suggestions = id
    ? []
    : suggestionsFor(
        form.kind,
        categoriesOf(form.kind, custom.data ?? []).map(money.categoryName),
        suggestionName,
      );
  const isApplied = (s: CategorySuggestion) =>
    s.icon === form.icon &&
    s.colorId === form.colorId &&
    normalizeCategoryName(suggestionName(s)) === normalizeCategoryName(form.name);

  const submit = () =>
    run(async () => {
      if (id) await updateCategory(db, id, form);
      else await createCategory(db, form);
      leave(goBack);
    });

  const remove = async () => {
    if (!id) return;
    const ok = await confirmDestructive(
      t('money.deleteCategoryTitle', { name: form.name }),
      t('money.deleteCategoryMessage'),
      t('common.delete'),
    );
    if (!ok) return;
    try {
      await deleteCategory(db, id);
      leave(goBack);
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  const title = id ? t('money.editCategory') : t('money.newCategory');
  if (load.state !== 'ready')
    return <EditLoadView state={load.state} onRetry={load.retry} title={title} />;

  const kindLabel = form.kind === 'income' ? t('money.income') : t('money.expense');
  return (
    <FormScreen
      submitLabel={id ? t('money.saveCategory') : t('money.addCategory')}
      onSubmit={submit}
      saving={saving}
      footer={
        id ? (
          <>
            <TextButton
              label={t('money.deleteCategory')}
              color="danger"
              onPress={() => void remove()}
            />
            <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
              {t('money.deleteCategoryMessage')}
            </AppText>
          </>
        ) : undefined
      }
    >
      <Stack.Screen options={{ title }} />
      <CategoryPreview
        kindLabel={kindLabel}
        category={{
          id: id ?? 'preview',
          kind: form.kind,
          builtIn: false,
          name: form.name,
          icon: form.icon,
          colorId: form.colorId,
          position: 0,
        }}
      />
      {id ? null : (
        <Segmented
          accessibilityLabel={t('money.categoryKind')}
          value={form.kind}
          onChange={(kind) => set({ kind })}
          options={[
            { value: 'expense', label: t('money.expense') },
            { value: 'income', label: t('money.income') },
          ]}
        />
      )}
      <TextField
        label={t('money.categoryName')}
        required
        value={form.name}
        onChangeText={(name) => set({ name })}
        error={errors.name}
        limit={fieldLimits.category}
        placeholder={t('money.categoryPlaceholder')}
      />
      {suggestions.length > 0 ? (
        <FieldShell
          label={t('money.categorySuggestions')}
          hint={t('money.categorySuggestionsHint')}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            // Les pastilles vont jusqu'au bord de l'écran, comme une rangée qui défile sur iOS.
            style={{ marginHorizontal: -spacing.xl }}
            contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl }}
          >
            {suggestions.map((s) => {
              const c = subjectColors.find((x) => x.id === s.colorId);
              const on = isApplied(s);
              return (
                <ChoiceChip
                  key={s.id}
                  label={suggestionName(s)}
                  on={on}
                  onPress={() => set({ name: suggestionName(s), icon: s.icon, colorId: s.colorId })}
                  accessibilityHint={t('money.categorySuggestionsHint')}
                  leading={
                    <Feather
                      name={s.icon as ComponentProps<typeof Feather>['name']}
                      size={16}
                      color={
                        on
                          ? colors.onPrimary
                          : ((scheme === 'dark' ? c?.strongDark : c?.strong) ?? colors.muted)
                      }
                    />
                  }
                />
              );
            })}
          </ScrollView>
        </FieldShell>
      ) : null}
      <FieldShell label={t('money.categoryIcon')}>
        <CategoryIconGrid
          icons={categoryIcons}
          value={form.icon}
          colorId={form.colorId}
          onChange={(icon) => set({ icon })}
          accessibilityLabel={t('money.categoryIcon')}
        />
      </FieldShell>
      <FieldShell label={t('money.categoryColor')}>
        <CategoryColorRow
          value={form.colorId}
          onChange={(colorId) => set({ colorId })}
          accessibilityLabel={t('money.categoryColor')}
        />
      </FieldShell>
    </FormScreen>
  );
}
