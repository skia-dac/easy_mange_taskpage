import Feather from '@expo/vector-icons/Feather';
import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';

import type { MoneyCategory } from '@/modules/finance';
import { minTouchSize, subjectColors, useTheme, type SubjectColor } from '@/shared/theme';
import { AppText, Tappable, useLargeText } from '@/shared/ui';
import { haptic } from '@/shared/ui/haptics';

import { CategoryBadge } from './CategoryBadge';

type FeatherName = ComponentProps<typeof Feather>['name'];

/** Couleur d'une catégorie (gris par défaut), en clair ou en sombre. */
function useCategoryColor(colorId: string) {
  const { scheme } = useTheme();
  const c: SubjectColor =
    subjectColors.find((x) => x.id === colorId) ?? subjectColors[subjectColors.length - 1]!;
  const dark = scheme === 'dark';
  return { strong: dark ? c.strongDark : c.strong, soft: dark ? c.softDark : c.soft };
}

/** Largeur réelle d'un bloc (estimée d'après l'écran avant la première mesure). */
function useWidth(estimate: number) {
  const [width, setWidth] = useState<number | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== width) setWidth(w);
  };
  return { width: width ?? estimate, onLayout };
}

/** Nom lisible d'une icône (« Transport »), jamais le nom technique Feather. */
export function useIconLabel() {
  const { t } = useTranslation();
  return (icon: string) => t(`money.icons.${icon}`, { defaultValue: t('money.categoryIcon') });
}

/**
 * Aperçu en direct de la catégorie : grande pastille, nom (ou « Ta catégorie ») et type. Le
 * lecteur d'écran l'annonce d'un bloc (nom, type, icône, couleur).
 */
export function CategoryPreview({
  category,
  kindLabel,
}: {
  category: MoneyCategory;
  kindLabel: string;
}) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const iconLabel = useIconLabel();
  const hasName = !!category.name?.trim();
  const name = hasName ? category.name!.trim() : t('money.categoryPreviewName');
  return (
    <View
      accessible
      accessibilityLabel={t('money.categoryPreview', {
        name,
        kind: kindLabel,
        icon: iconLabel(category.icon),
        color: t(`money.colors.${category.colorId}`, { defaultValue: '' }),
      })}
      accessibilityLiveRegion="polite"
      style={{
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: spacing.xl,
        paddingHorizontal: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
      }}
    >
      <CategoryBadge category={category} size={72} />
      <AppText
        variant="heading"
        color={hasName ? 'text' : 'muted'}
        style={{ textAlign: 'center' }}
        numberOfLines={2}
      >
        {name}
      </AppText>
      <AppText variant="caption" color="muted">
        {kindLabel}
      </AppText>
    </View>
  );
}

/**
 * Grille d'icônes (choix unique). Le nombre de colonnes suit la largeur, et les cases grandissent
 * avec un très grand texte. Icône choisie : fond doux de la couleur, icône forte, anneau et coche.
 */
export function CategoryIconGrid({
  icons,
  value,
  colorId,
  onChange,
  accessibilityLabel,
}: {
  icons: readonly string[];
  value: string;
  colorId: string;
  onChange: (icon: string) => void;
  accessibilityLabel: string;
}) {
  const { colors, radius, spacing } = useTheme();
  const large = useLargeText();
  const iconLabel = useIconLabel();
  const color = useCategoryColor(colorId);
  const window = useWindowDimensions();
  const { width, onLayout } = useWidth(window.width - spacing.xl * 2);
  const gap = spacing.sm;
  const minCell = large ? minTouchSize + 12 : minTouchSize;
  const columns = Math.max(4, Math.floor((width + gap) / (minCell + gap)));
  const cell = Math.floor((width - gap * (columns - 1)) / columns);
  return (
    <View
      onLayout={onLayout}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}
    >
      {icons.map((icon) => {
        const selected = icon === value;
        return (
          <Tappable
            key={icon}
            testID={`icon-${icon}`}
            accessibilityRole="radio"
            accessibilityLabel={iconLabel(icon)}
            accessibilityState={{ checked: selected }}
            onPress={() => {
              if (selected) return;
              haptic('selection');
              onChange(icon);
            }}
            style={{
              width: cell,
              height: cell,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? color.soft : colors.surface,
              borderWidth: 2,
              borderColor: selected ? color.strong : 'transparent',
            }}
          >
            <Feather
              name={icon as FeatherName}
              size={large ? 26 : 22}
              color={selected ? color.strong : colors.muted}
            />
            {selected ? (
              <View
                style={{
                  position: 'absolute',
                  top: 3,
                  right: 3,
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  backgroundColor: color.strong,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Feather name="check" size={11} color={colors.surface} />
              </View>
            ) : null}
          </Tappable>
        );
      })}
    </View>
  );
}

/** Pastille de couleur visible : environ 36 pt, dans une zone touchable de 44 pt. */
const SWATCH = 36;

/**
 * Couleurs sur une seule ligne (toutes les couleurs des matières). Couleur choisie : coche et
 * anneau. Sur un écran trop étroit pour 8 zones de 40 pt, elles passent sur deux lignes de 4.
 */
export function CategoryColorRow({
  value,
  onChange,
  accessibilityLabel,
}: {
  value: string;
  onChange: (colorId: string) => void;
  accessibilityLabel: string;
}) {
  const { t } = useTranslation();
  const { colors, scheme, spacing } = useTheme();
  const window = useWindowDimensions();
  const { width, onLayout } = useWidth(window.width - spacing.xl * 2);
  const columns = width >= subjectColors.length * 40 ? subjectColors.length : 4;
  const slot = width / columns;
  const ring = Math.min(minTouchSize, slot);
  return (
    <View
      onLayout={onLayout}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: 'row', flexWrap: 'wrap' }}
    >
      {subjectColors.map((c) => {
        const selected = c.id === value;
        const strong = scheme === 'dark' ? c.strongDark : c.strong;
        return (
          <Tappable
            key={c.id}
            testID={`color-${c.id}`}
            accessibilityRole="radio"
            accessibilityLabel={t(`money.colors.${c.id}`)}
            accessibilityState={{ checked: selected }}
            onPress={() => {
              if (selected) return;
              haptic('selection');
              onChange(c.id);
            }}
            style={{
              width: slot,
              height: minTouchSize,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: ring,
                height: ring,
                borderRadius: ring / 2,
                borderWidth: 2,
                borderColor: selected ? strong : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <View
                style={{
                  width: Math.min(SWATCH, ring - 8),
                  height: Math.min(SWATCH, ring - 8),
                  borderRadius: SWATCH / 2,
                  backgroundColor: strong,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {selected ? <Feather name="check" size={18} color={colors.surface} /> : null}
              </View>
            </View>
          </Tappable>
        );
      })}
    </View>
  );
}
