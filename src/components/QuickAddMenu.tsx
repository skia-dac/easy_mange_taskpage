import Feather from '@expo/vector-icons/Feather';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { itemLooks, type ItemLook } from '@/components/itemTypes';

import { toIsoDate, type IsoDate } from '@/shared/dates';
import { useSpaces } from '@/shared/SpacesContext';
import type { SpaceId } from '@/shared/spaces';
import { useTabBarInset } from '@/shared/tabBarVisibility';
import { minTouchSize, useTheme } from '@/shared/theme';
import { AppText, Fab, Tappable, useAfterDismiss, useCoversToast } from '@/shared/ui';

type Item = ItemLook & {
  key: string;
  /** Visible seulement si cet espace est actif. */
  needs?: SpaceId;
  label: string;
  href: Href;
};

type Props = {
  /** Note pré-remplie avec le prochain cours (Aujourd'hui, Études). */
  note?: Record<string, string>;
  /** Jour choisi dans le calendrier : les ajouts datés partent de ce jour. */
  date?: IsoDate;
};

/**
 * Le « + » d'Aujourd'hui et du Calendrier : un appui ouvre les ajouts les plus fréquents
 * (dépense, entrée d'argent, tâche, note, rendez-vous, révision) et, avec Études, « Autre »
 * pour le reste (examen, cours, matière). Ailleurs, le « + » crée directement.
 *
 * Le menu vit dans une fenêtre (`Modal`) : son voile couvre tout l'écran, barre d'onglets
 * comprise (on ne change pas d'onglet menu ouvert), et le bouton retour d'Android le ferme. Une
 * copie du « + », devenu ×, est posée au même endroit par-dessus le voile pour le refermer.
 */
export function QuickAddMenu({ note, date }: Props) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const tabBarInset = useTabBarInset();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  useCoversToast(open);
  const spaces = useSpaces();
  const first = useRef<View>(null);
  const withDate = date ? { date } : {};

  useEffect(() => {
    if (!open) return;
    // Lecteur d'écran : le focus va au premier choix du menu dès son ouverture.
    const focus = setTimeout(() => {
      if (first.current) AccessibilityInfo.sendAccessibilityEvent(first.current, 'focus');
    }, 200);
    return () => clearTimeout(focus);
  }, [open]);

  const items: Item[] = [
    {
      key: 'expense',
      needs: 'personal',
      label: t('quickAdd.expense'),
      ...itemLooks.expense,
      href: { pathname: '/money/add', params: { kind: 'expense', ...withDate } },
    },
    {
      key: 'income',
      needs: 'personal',
      label: t('quickAdd.income'),
      ...itemLooks.income,
      href: { pathname: '/money/add', params: { kind: 'income', ...withDate } },
    },
    {
      key: 'task',
      label: t('add.task'),
      ...itemLooks.task,
      // Une seule fiche : avec une matière, la tâche est rangée dans les études. Depuis Aujourd'hui
      // (sans jour choisi), la tâche est pour aujourd'hui : elle apparaît tout de suite dans la liste.
      href: { pathname: '/work/form', params: { date: date ?? toIsoDate(new Date()) } },
    },
    {
      key: 'note',
      label: spaces.has('study') && note ? t('quickAdd.note') : t('add.note'),
      ...itemLooks.note,
      href: {
        pathname: '/notes/[id]',
        params: { id: 'new', ...(spaces.has('study') ? note : {}) },
      },
    },
    {
      key: 'event',
      label: t('quickAdd.event'),
      ...itemLooks.event,
      href: { pathname: '/events/form', params: withDate },
    },
    {
      key: 'revision',
      // Ouvre le minuteur : le libellé le dit (ce n'est pas une séance du plan de révision).
      label: spaces.has('study') ? t('quickAdd.revision') : t('spaces.focusTitle'),
      ...itemLooks.timer,
      href: '/study',
    },
    {
      // Examen, cours, matière : tout appartient à Études, « Autre » n'existe qu'avec lui.
      key: 'other',
      needs: 'study',
      label: t('quickAdd.other'),
      ...itemLooks.other,
      href: { pathname: '/add', params: withDate },
    },
  ];

  const shown = items.filter((i) => !i.needs || spaces.has(i.needs));

  // Le menu monte depuis le + et s'arrête sous la barre d'état.
  const menuBottom = spacing.xl + tabBarInset + 58 + spacing.md;
  const menuMaxHeight = Math.max(minTouchSize * 2, height - menuBottom - insets.top - spacing.md);

  // L'écran choisi s'ouvre une fois la fenêtre du menu fermée (iPhone : sinon il peut être ignoré).
  const afterClose = useAfterDismiss();
  const go = (href: Href) => {
    setOpen(false);
    afterClose.schedule(() => router.push(href));
  };

  return (
    <>
      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setOpen(false)}
        onDismiss={afterClose.onDismiss}
      >
        <View
          testID="quick-add-menu"
          accessibilityViewIsModal
          onAccessibilityEscape={() => setOpen(false)}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(150)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.close')}
              onPress={() => setOpen(false)}
              style={{ flex: 1, backgroundColor: colors.scrim }}
            />
          </Animated.View>
          <View
            accessibilityRole="menu"
            accessibilityLabel={t('add.title')}
            style={{
              position: 'absolute',
              left: spacing.xl,
              right: spacing.xl,
              bottom: menuBottom,
            }}
          >
            {/* Grand texte : le menu ne passe plus sous le haut de l'écran, il défile. */}
            <ScrollView
              style={{ maxHeight: menuMaxHeight }}
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end' }}
              bounces={false}
            >
              {/* La place libre à gauche des choix ferme le menu, comme le fond. */}
              <Pressable
                accessible={false}
                onPress={() => setOpen(false)}
                style={{ alignItems: 'flex-end', gap: spacing.sm }}
              >
                {shown.map((item, i) => (
                  <Animated.View
                    key={item.key}
                    entering={FadeInDown.duration(160).delay((shown.length - 1 - i) * 25)}
                  >
                    <Tappable
                      ref={i === 0 ? first : undefined}
                      accessibilityRole="menuitem"
                      accessibilityLabel={item.label}
                      onPress={() => go(item.href)}
                      style={() => ({
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                        minHeight: Math.max(48, minTouchSize),
                        paddingLeft: spacing.sm,
                        paddingRight: spacing.lg,
                        borderRadius: radius.pill,
                        backgroundColor: colors.surface,
                      })}
                    >
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: radius.sm,
                          backgroundColor: colors[item.background],
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Feather name={item.icon} size={17} color={colors[item.color]} />
                      </View>
                      <AppText variant="bodyStrong" style={{ flexShrink: 1 }}>
                        {item.label}
                      </AppText>
                    </Tappable>
                  </Animated.View>
                ))}
              </Pressable>
            </ScrollView>
          </View>
          <Fab
            overlay
            open
            bottomInset={tabBarInset}
            accessibilityLabel={t('common.close')}
            onPress={() => setOpen(false)}
          />
        </View>
      </Modal>
      <Fab
        open={open}
        bottomInset={tabBarInset}
        accessibilityLabel={open ? t('common.close') : t('add.title')}
        onPress={() => setOpen((value) => !value)}
      />
    </>
  );
}
