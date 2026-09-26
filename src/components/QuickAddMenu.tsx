import Feather from '@expo/vector-icons/Feather';
import { router, type Href } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { BackHandler, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { useSpaces } from '@/shared/SpacesContext';
import type { SpaceId } from '@/shared/spaces';
import { useTabBarInset } from '@/shared/tabBarVisibility';
import { useTheme, type ColorTokens } from '@/shared/theme';
import { AppText, Fab } from '@/shared/ui';

type Item = {
  key: string;
  /** Visible seulement si cet espace est actif. */
  needs?: SpaceId;
  label: string;
  icon: ComponentProps<typeof Feather>['name'];
  color: keyof ColorTokens;
  background: keyof ColorTokens;
  href: Href;
};

/**
 * Le « + » d'Aujourd'hui : un appui ouvre les ajouts les plus fréquents en un geste
 * (dépense, entrée d'argent, tâche, devoir, note, révision), et « Autre » pour le reste.
 */
export function QuickAddMenu({ note }: { note?: Record<string, string> }) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const tabBarInset = useTabBarInset();
  const [open, setOpen] = useState(false);
  const spaces = useSpaces();

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpen(false);
      return true;
    });
    return () => sub.remove();
  }, [open]);

  const items: Item[] = [
    {
      key: 'expense',
      needs: 'personal',
      label: t('quickAdd.expense'),
      icon: 'minus',
      color: 'danger',
      background: 'dangerSoft',
      href: { pathname: '/money/add', params: { kind: 'expense' } },
    },
    {
      key: 'income',
      needs: 'personal',
      label: t('quickAdd.income'),
      icon: 'plus',
      color: 'success',
      background: 'successSoft',
      href: { pathname: '/money/add', params: { kind: 'income' } },
    },
    {
      key: 'task',
      label: t('add.task'),
      icon: 'check',
      color: 'primary',
      background: 'primarySoft',
      href: { pathname: '/work/form', params: { kind: 'task' } },
    },
    {
      key: 'assignment',
      needs: 'study',
      label: t('add.assignment'),
      icon: 'book',
      color: 'primary',
      background: 'primarySoft',
      href: { pathname: '/work/form', params: { kind: 'assignment' } },
    },
    {
      key: 'note',
      label: spaces.has('study') ? t('quickAdd.note') : t('add.note'),
      icon: 'file-text',
      color: 'warning',
      background: 'warningSoft',
      href: {
        pathname: '/notes/[id]',
        params: { id: 'new', ...(spaces.has('study') ? note : {}) },
      },
    },
    {
      key: 'event',
      label: t('quickAdd.event'),
      icon: 'calendar',
      color: 'warning',
      background: 'warningSoft',
      href: { pathname: '/events/form', params: {} },
    },
    {
      key: 'revision',
      label: spaces.has('study') ? t('quickAdd.revision') : t('spaces.focusTitle'),
      icon: 'clock',
      color: 'success',
      background: 'successSoft',
      href: '/study',
    },
    {
      key: 'other',
      label: t('quickAdd.other'),
      icon: 'more-horizontal',
      color: 'muted',
      background: 'background',
      href: '/add',
    },
  ];

  const shown = items.filter((i) => !i.needs || spaces.has(i.needs));

  const go = (href: Href) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      {open ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
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
            style={{
              position: 'absolute',
              right: spacing.xl,
              bottom: spacing.xl + 58 + spacing.md,
              alignItems: 'flex-end',
              gap: spacing.sm,
            }}
          >
            {shown.map((item, i) => (
              <Animated.View
                key={item.key}
                entering={FadeInDown.duration(160).delay((shown.length - 1 - i) * 25)}
              >
                <Pressable
                  accessibilityRole="menuitem"
                  onPress={() => go(item.href)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    minHeight: 48,
                    paddingLeft: spacing.sm,
                    paddingRight: spacing.lg,
                    borderRadius: radius.pill,
                    backgroundColor: colors.surface,
                    opacity: pressed ? 0.85 : 1,
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
                  <AppText variant="bodyStrong">{item.label}</AppText>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </View>
      ) : null}
      <Fab
        open={open}
        bottomInset={tabBarInset}
        accessibilityLabel={open ? t('common.close') : t('add.title')}
        onPress={() => setOpen((value) => !value)}
      />
    </>
  );
}
