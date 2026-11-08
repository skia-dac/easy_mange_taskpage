import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import type { MoneyCategory } from '@/modules/finance';
import { minTouchSize, useTheme } from '@/shared/theme';
import { AppText, BottomSheet, Tappable, useAfterDismiss, useLargeText } from '@/shared/ui';
import { haptic } from '@/shared/ui/haptics';

import { CategoryBadge } from './CategoryBadge';
import { SelectChip } from './SelectChip';

/** Catégories montrées sur la ligne, avant « Tout voir » (les plus utilisées). */
export const QUICK_CATEGORIES = 7;

type Props = {
  /** Toutes les catégories du type, dans l'ordre où les proposer (les plus utilisées d'abord). */
  categories: readonly MoneyCategory[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Ouvre l'écran « Nouvelle catégorie » (après la fermeture de la fenêtre). */
  onCreate: () => void;
  nameOf: (c: MoneyCategory) => string;
};

/**
 * Choix de la catégorie, sur une ligne de pastilles qui défile : les 7 plus utilisées (la choisie
 * toujours visible, en tête si elle vient de « Tout voir »), puis « Tout voir », qui ouvre la
 * liste complète en bas de l'écran, avec « Nouvelle catégorie ». Les noms ne sont jamais coupés.
 * Pour le lecteur d'écran : un groupe de boutons radio, chacun avec son nom complet.
 */
export function CategoryPicker({ categories, selectedId, onSelect, onCreate, nameOf }: Props) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const large = useLargeText();
  const [open, setOpen] = useState(false);
  const afterDismiss = useAfterDismiss(300);

  // Retour de « Nouvelle catégorie » : la catégorie qui vient d'apparaître est choisie.
  const known = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!known.current) return;
    const created = categories.find((c) => !known.current!.has(c.id));
    if (created) {
      known.current = null;
      onSelect(created.id);
    }
  }, [categories, onSelect]);

  const quick = categories.slice(0, QUICK_CATEGORIES);
  const chosen = categories.find((c) => c.id === selectedId);
  const row = chosen && !quick.includes(chosen) ? [chosen, ...quick] : quick;

  const create = () => {
    setOpen(false);
    afterDismiss.schedule(() => {
      known.current = new Set(categories.map((c) => c.id));
      onCreate();
    });
  };

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="caption" color="muted">
        {t('money.categoriesLabel')}
      </AppText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // La ligne va jusqu'aux bords de l'écran : on voit qu'elle défile.
        style={{ marginHorizontal: -spacing.xl }}
        contentContainerStyle={{ paddingHorizontal: spacing.xl }}
      >
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('money.categoriesLabel')}
          style={{ flexDirection: 'row', gap: spacing.sm }}
        >
          {row.map((c) => (
            <SelectChip
              key={c.id}
              testID={`category-${c.id}`}
              label={nameOf(c)}
              selected={c.id === selectedId}
              onPress={() => onSelect(c.id)}
              leading={<CategoryBadge category={c} size={32} />}
            />
          ))}
          <SelectChip
            role="button"
            testID="category-all"
            label={t('common.seeAll')}
            accessibilityLabel={t('money.seeAllCategories', { count: categories.length })}
            onPress={() => setOpen(true)}
            leading={
              <View
                style={{
                  width: 32,
                  height: 32,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="grid" size={18} color={colors.primary} />
              </View>
            }
          />
        </View>
      </ScrollView>

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        onDismissed={afterDismiss.onDismiss}
      >
        <AppText variant="heading" accessibilityRole="header">
          {t('money.chooseCategory')}
        </AppText>
        <View
          accessibilityRole="radiogroup"
          accessibilityLabel={t('money.categoriesLabel')}
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.xs }}
        >
          {categories.map((c) => {
            const on = c.id === selectedId;
            return (
              <Tappable
                key={c.id}
                testID={`sheet-category-${c.id}`}
                accessibilityRole="radio"
                accessibilityLabel={nameOf(c)}
                accessibilityState={{ checked: on }}
                onPress={() => {
                  haptic('selection');
                  onSelect(c.id);
                  setOpen(false);
                }}
                style={{
                  // Deux colonnes ; une seule avec un très grand texte (les noms restent entiers).
                  width: large ? '100%' : '48%',
                  flexGrow: 1,
                  minHeight: minTouchSize + 8,
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: on ? colors.primary : colors.border,
                  backgroundColor: on ? colors.primarySoft : colors.surface,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                }}
              >
                <CategoryBadge category={c} size={32} />
                <AppText variant="bodyStrong" style={{ flex: 1 }}>
                  {nameOf(c)}
                </AppText>
                {on ? <Feather name="check" size={18} color={colors.primary} /> : null}
              </Tappable>
            );
          })}
        </View>
        <Tappable
          testID="category-new"
          accessibilityRole="button"
          onPress={create}
          style={{
            minHeight: minTouchSize + 8,
            marginTop: spacing.xs,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderStyle: 'dashed',
            borderColor: colors.outline,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
          }}
        >
          <Feather name="plus" size={18} color={colors.primary} />
          <AppText variant="bodyStrong" color="primary">
            {t('money.addCategory')}
          </AppText>
        </Tappable>
      </BottomSheet>
    </View>
  );
}
