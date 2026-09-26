import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spaceColor } from '@/components/SpaceUi';
import { setActiveSpaces, setOnboardingDone, useAuth } from '@/modules/identity';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { logger } from '@/shared/logger';
import { spaceIds, toggleSpace, type ActiveSpaces, type SpaceId } from '@/shared/spaces';
import { useTheme } from '@/shared/theme';
import { AppText, Button, Card, IconBadge, showError, TextButton } from '@/shared/ui';

type Step = { icon: ComponentProps<typeof Feather>['name']; title: string; body: string };

const SPACE_ICONS: Record<SpaceId, ComponentProps<typeof Feather>['name']> = {
  study: 'book-open',
  work: 'briefcase',
  personal: 'home',
};

/**
 * Première utilisation (§93) : courte introduction, « Tu utilises MySky pour… » (les espaces,
 * au moins un), puis « Comment veux-tu commencer ? ».
 */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { colors, radius, spacing, scheme } = useTheme();
  const [index, setIndex] = useState(0);
  // Un espace est toujours choisi : Études au départ (l'étudiant peut en ajouter ou changer).
  const [picked, setPicked] = useState<ActiveSpaces>(['study']);
  const [savingSpaces, setSavingSpaces] = useState(false);

  const steps: Step[] = [
    { icon: 'sun', title: t('onboarding.title1'), body: t('onboarding.body1') },
    { icon: 'calendar', title: t('onboarding.title2'), body: t('onboarding.body2') },
    { icon: 'bell', title: t('onboarding.title3'), body: t('onboarding.body3') },
  ];
  const last = steps.length;
  const step = steps[index];

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
    setIndex(last + 1);
  };

  // Points de progression : les 3 pages d'intro, puis Espaces, puis « Comment commencer ».
  const total = steps.length + 2;
  const dots = (
    <View
      accessibilityLabel={t('onboarding.progress', { step: Math.min(index, total - 1) + 1, total })}
      style={{ flexDirection: 'row', gap: spacing.xs }}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={{
            height: 8,
            width: i === Math.min(index, total - 1) ? 26 : 8,
            borderRadius: 4,
            backgroundColor: i === Math.min(index, total - 1) ? colors.primary : colors.border,
          }}
        />
      ))}
    </View>
  );

  if (index === last) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, padding: spacing.xl, gap: spacing.lg }}>
          {dots}
          <AppText variant="title">{t('spaces.onboardingTitle')}</AppText>
          <AppText color="muted">{t('spaces.onboardingHint')}</AppText>
          {spaceIds.map((id) => {
            const on = picked.includes(id);
            const c = spaceColor(id);
            return (
              <Card
                key={id}
                onPress={() => pick(id, !on)}
                accessibilityLabel={t(`spaces.name.${id}`)}
                style={{ borderWidth: 2, borderColor: on ? colors.primary : colors.border }}
              >
                <View
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
                >
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
          <View style={{ flex: 1 }} />
          <Button
            label={t('onboarding.next')}
            disabled={savingSpaces}
            onPress={() => void saveSpaces()}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (index > last || !step) {
    const choice = (
      icon: ComponentProps<typeof Feather>['name'],
      title: string,
      hint: string,
      onPress: () => void,
    ) => (
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
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, padding: spacing.xl, gap: spacing.lg, justifyContent: 'center' }}>
          {dots}
          <AppText variant="title">{t('onboarding.howTitle')}</AppText>
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
          {choice(
            'compass',
            picked.includes('study') ? t('onboarding.later') : t('onboarding.startNow'),
            t('onboarding.laterHint'),
            () => void finish('today'),
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: spacing.xl, gap: spacing.lg }}>
        <View style={{ alignItems: 'flex-end' }}>
          <TextButton label={t('onboarding.skip')} color="muted" onPress={() => setIndex(last)} />
        </View>
        <View
          style={{
            flex: 1,
            borderRadius: radius.xl,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
            maxHeight: 340,
          }}
        >
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: 40,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Feather name={step.icon} size={56} color={colors.onPrimary} />
          </View>
        </View>
        {dots}
        <AppText variant="title">{step.title}</AppText>
        <AppText color="muted" style={{ fontSize: 16, lineHeight: 24 }}>
          {step.body}
        </AppText>
        <View style={{ flex: 1 }} />
        <Button
          label={index === last - 1 ? t('onboarding.start') : t('onboarding.next')}
          onPress={() => setIndex(index + 1)}
        />
      </View>
    </SafeAreaView>
  );
}
