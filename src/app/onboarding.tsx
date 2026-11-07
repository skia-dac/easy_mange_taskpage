import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spaceColor } from '@/components/SpaceUi';
import { setActiveSpaces, setOnboardingDone, useAuth } from '@/modules/identity';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { logger } from '@/shared/logger';
import { spaceIds, toggleSpace, type ActiveSpaces, type SpaceId } from '@/shared/spaces';
import { useTheme } from '@/shared/theme';
import { AppText, Button, Card, IconBadge, showError, TextButton } from '@/shared/ui';

type Icon = ComponentProps<typeof Feather>['name'];

const SPACE_ICONS: Record<SpaceId, Icon> = {
  study: 'book-open',
  work: 'briefcase',
  personal: 'home',
};

/** Les 3 étapes : ce que fait MySky, « Tu utilises MySky pour… », « Comment veux-tu commencer ? ». */
const STEPS = 3;

/**
 * Première utilisation (§93), en 3 étapes au plus : une seule page d'introduction, les espaces
 * (au moins un), puis « Comment veux-tu commencer ? ». Chaque étape défile (petit écran, grand
 * texte) ; « Précédent » revient en arrière, le bouton principal dit « Suivant » puis « Commencer ».
 */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { colors, radius, spacing, scheme } = useTheme();
  const [index, setIndex] = useState(0);
  // Un espace est toujours choisi : Études au départ (l'étudiant peut en ajouter ou changer).
  const [picked, setPicked] = useState<ActiveSpaces>(['study']);
  const [savingSpaces, setSavingSpaces] = useState(false);
  const { enabled: accounts } = useAuth();

  const finish = async (then: 'today' | 'subject' | 'account') => {
    try {
      await setOnboardingDone(db);
    } catch (e) {
      logger.error(e, { where: 'onboarding' });
    }
    router.replace('/');
    if (then === 'subject') router.push('/subjects/form');
    if (then === 'account') router.push('/auth/sign-in');
  };

  // « Au moins un espace » : seulement quand on essaie de décocher le dernier, pas avant.
  const [blocked, setBlocked] = useState(false);
  const pick = (id: SpaceId, on: boolean) => {
    const next = toggleSpace(picked, id, on);
    setBlocked(next === picked && !on);
    setPicked(next);
  };

  const saveSpaces = async () => {
    setSavingSpaces(true);
    try {
      await setActiveSpaces(db, picked);
    } catch (e) {
      // Les espaces n'ont pas été enregistrés : on le dit et on reste sur l'étape.
      logger.error(e, { where: 'onboarding' });
      showError(userMessageKey(e));
      setSavingSpaces(false);
      return;
    }
    setSavingSpaces(false);
    setIndex(2);
  };

  const dots = (
    <View
      accessible
      accessibilityLabel={t('onboarding.progress', { step: index + 1, total: STEPS })}
      style={{ flexDirection: 'row', gap: spacing.xs }}
    >
      {Array.from({ length: STEPS }, (_, i) => (
        <View
          key={i}
          style={{
            height: 8,
            width: i === index ? 26 : 8,
            borderRadius: 4,
            backgroundColor: i === index ? colors.primary : colors.border,
          }}
        />
      ))}
    </View>
  );

  const last = index === STEPS - 1;
  const primary = {
    label: last ? t('onboarding.start') : t('onboarding.next'),
    disabled: index === 1 && savingSpaces,
    onPress: () => {
      if (index === 0) setIndex(1);
      else if (index === 1) void saveSpaces();
      else void finish('today');
    },
  };

  /** Page commune : contenu qui défile, puis « Précédent » et le bouton principal. */
  const page = (content: ReactNode, top?: ReactNode) => (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        testID="onboarding-scroll"
        contentContainerStyle={{ flexGrow: 1, padding: spacing.xl, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        {top}
        {dots}
        {content}
        <View style={{ flex: 1, minHeight: spacing.lg }} />
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          {index > 0 ? (
            <Button
              label={t('onboarding.previous')}
              variant="secondary"
              onPress={() => setIndex(index - 1)}
              style={{ flex: 1 }}
            />
          ) : null}
          <Button
            label={primary.label}
            disabled={primary.disabled}
            onPress={primary.onPress}
            style={{ flex: 1 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  if (index === 0) {
    const point = (icon: Icon, title: string, body: string) => (
      <View accessible style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        <IconBadge icon={icon} size={44} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText color="muted">{body}</AppText>
        </View>
      </View>
    );
    return page(
      <>
        <View
          style={{
            borderRadius: radius.xl,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: spacing.xxl,
          }}
        >
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 32,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name="sun" size={44} color={colors.onPrimary} />
          </View>
        </View>
        <AppText variant="title" accessibilityRole="header">
          {t('onboarding.welcome')}
        </AppText>
        {point('sun', t('onboarding.title1'), t('onboarding.body1'))}
        {point('layers', t('onboarding.title2'), t('onboarding.body2'))}
        {point('bell', t('onboarding.title3'), t('onboarding.body3'))}
      </>,
      <View style={{ alignItems: 'flex-end' }}>
        <TextButton label={t('onboarding.skip')} color="muted" onPress={() => setIndex(1)} />
      </View>,
    );
  }

  if (index === 1) {
    return page(
      <>
        <AppText variant="title" accessibilityRole="header">
          {t('spaces.onboardingTitle')}
        </AppText>
        <AppText color="muted">{t('spaces.onboardingHint')}</AppText>
        {spaceIds.map((id) => {
          const on = picked.includes(id);
          const c = spaceColor(id);
          return (
            <Card
              key={id}
              onPress={() => pick(id, !on)}
              accessibilityLabel={t(`spaces.name.${id}`)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={{ borderWidth: 2, borderColor: on ? colors.primary : colors.border }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: scheme === 'dark' ? c.softDark : c.soft,
                  }}
                >
                  <Feather
                    name={SPACE_ICONS[id]}
                    size={22}
                    color={scheme === 'dark' ? c.strongDark : c.strong}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong">{t(`spaces.name.${id}`)}</AppText>
                  <AppText variant="caption" color="muted">
                    {t(`spaces.hint.${id}`)}
                  </AppText>
                </View>
                <Feather
                  name={on ? 'check-circle' : 'circle'}
                  size={24}
                  color={on ? colors.primary : colors.border}
                />
              </View>
            </Card>
          );
        })}
        <AppText variant="caption" color="muted">
          {blocked ? t('spaces.lastOne') : t('spaces.changeLater')}
        </AppText>
      </>,
    );
  }

  const choice = (icon: Icon, title: string, hint: string, onPress: () => void) => (
    <Card onPress={onPress} accessibilityLabel={title}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <IconBadge icon={icon} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong">{title}</AppText>
          <AppText variant="caption" color="muted">
            {hint}
          </AppText>
        </View>
        <Feather name="chevron-right" size={20} color={colors.muted} />
      </View>
    </Card>
  );
  return page(
    <>
      <AppText variant="title" accessibilityRole="header">
        {t('onboarding.howTitle')}
      </AppText>
      <AppText color="muted">{t('onboarding.howHint')}</AppText>
      {picked.includes('study')
        ? choice(
            'edit-3',
            t('onboarding.manual'),
            t('onboarding.manualHint'),
            () => void finish('subject'),
          )
        : null}
      {accounts
        ? choice(
            'log-in',
            t('onboarding.account'),
            t('onboarding.accountHint'),
            () => void finish('account'),
          )
        : null}
      <AppText variant="caption" color="muted">
        {t('onboarding.laterHint')}
      </AppText>
    </>,
  );
}
