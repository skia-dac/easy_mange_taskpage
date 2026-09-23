import Feather from '@expo/vector-icons/Feather';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { setOnboardingDone } from '@/modules/identity';
import { useDb } from '@/shared/db';
import { logger } from '@/shared/logger';
import { useTheme } from '@/shared/theme';
import { AppText, Button, Card, IconBadge, TextButton } from '@/shared/ui';

type Step = { icon: ComponentProps<typeof Feather>['name']; title: string; body: string };

/** Première utilisation (§93) : courte introduction, puis « Comment veux-tu commencer ? ». */
export default function OnboardingScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { colors, radius, spacing } = useTheme();
  const [index, setIndex] = useState(0);

  const steps: Step[] = [
    { icon: 'sun', title: t('onboarding.title1'), body: t('onboarding.body1') },
    { icon: 'calendar', title: t('onboarding.title2'), body: t('onboarding.body2') },
    { icon: 'bell', title: t('onboarding.title3'), body: t('onboarding.body3') },
  ];
  const last = steps.length;
  const step = steps[index];

  const finish = async (then: 'today' | 'subject') => {
    try {
      await setOnboardingDone(db);
    } catch (e) {
      logger.error(e, { where: 'onboarding' });
    }
    router.replace('/');
    if (then === 'subject') router.push('/subjects/form');
  };

  if (index === last || !step) {
    const choice = (
      icon: ComponentProps<typeof Feather>['name'],
      title: string,
      hint: string,
      onPress: () => void,
      disabled = false,
    ) => (
      <Card
        onPress={disabled ? undefined : onPress}
        accessibilityLabel={title}
        style={{ opacity: disabled ? 0.55 : 1 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <IconBadge icon={icon} size={48} />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">{title}</AppText>
            <AppText variant="caption" color="muted">
              {hint}
            </AppText>
          </View>
          {!disabled ? <Feather name="chevron-right" size={20} color={colors.muted} /> : null}
        </View>
      </Card>
    );
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, padding: spacing.xl, gap: spacing.lg, justifyContent: 'center' }}>
          <AppText variant="title">{t('onboarding.howTitle')}</AppText>
          <AppText color="muted">{t('onboarding.howHint')}</AppText>
          {choice(
            'edit-3',
            t('onboarding.manual'),
            t('onboarding.manualHint'),
            () => void finish('subject'),
          )}
          {choice(
            'camera',
            t('onboarding.import'),
            t('onboarding.importHint'),
            () => undefined,
            true,
          )}
          {choice(
            'compass',
            t('onboarding.later'),
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
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          {steps.map((_, i) => (
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
