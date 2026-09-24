import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useProfile } from '@/hooks/useProfile';
import { useSubjects } from '@/hooks/useSubjects';
import { fullName, initials, useAuth } from '@/modules/identity';
import { attachmentUri } from '@/modules/platform';
import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/shared/theme';
import { colorOf } from '@/modules/academic';
import { AppText, Card, IconBadge, ListRow, Screen, SectionHeader, SubjectDot } from '@/shared/ui';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { subjects } = useSubjects();
  const { profile } = useProfile();
  const { colors, spacing, radius } = useTheme();
  const name = fullName(profile);
  const auth = useAuth();
  const details = [profile?.field, profile?.level, profile?.university, profile?.academicYear]
    .filter(Boolean)
    .join(' · ');

  return (
    <Screen title={t('profile.title')}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('profile.edit')}
        onPress={() => router.push('/profile/edit')}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.lg,
          borderRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 22,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {profile?.photoPath ? (
            <Image
              source={{ uri: attachmentUri(profile.photoPath) }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <AppText variant="heading" color="onPrimary">
              {initials(profile) || '?'}
            </AppText>
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{name || t('profile.noName')}</AppText>
          <AppText variant="caption" color="muted">
            {details || t('profile.completeHint')}
          </AppText>
        </View>
        <AppText variant="bodyStrong" color="primary">
          {t('common.edit')}
        </AppText>
      </Pressable>
      {auth.enabled ? (
        <Card>
          <ListRow
            title={t('account.title')}
            subtitle={auth.email ?? t('account.noAccount')}
            leading={
              <IconBadge
                icon={auth.userId ? 'cloud' : 'cloud-off'}
                color={auth.userId ? 'success' : 'primary'}
                background={auth.userId ? 'successSoft' : 'primarySoft'}
              />
            }
            onPress={() => router.push('/account')}
          />
        </Card>
      ) : null}
      <SectionHeader
        title={t('profile.subjects')}
        action={
          subjects.length > 0
            ? { label: t('common.seeAll'), onPress: () => router.push('/subjects') }
            : undefined
        }
      />
      <Card>
        {subjects.length === 0 ? (
          <AppText color="muted">{t('profile.emptySubjects')}</AppText>
        ) : null}
        {subjects.slice(0, 6).map((s) => (
          <ListRow
            key={s.id}
            title={s.name}
            subtitle={[s.teacher, s.room].filter(Boolean).join(' · ')}
            leading={<SubjectDot color={colorOf(s)} size={14} />}
            onPress={() => router.push({ pathname: '/subjects/[id]', params: { id: s.id } })}
          />
        ))}
        <ListRow
          title={t('profile.addSubject')}
          leading={<IconBadge icon="plus" />}
          onPress={() => router.push('/subjects/form')}
        />
      </Card>

      <SectionHeader title={t('profile.progress')} />
      <Card>
        <ListRow
          title={t('habits.title')}
          subtitle={t('profile.habitsHint')}
          leading={<IconBadge icon="target" />}
          onPress={() => router.push('/habits')}
        />
        <ListRow
          title={t('mood.title')}
          subtitle={t('profile.moodHint')}
          leading={<IconBadge icon="smile" color="warning" background="warningSoft" />}
          onPress={() => router.push('/mood')}
        />
        <ListRow
          title={t('review.title')}
          subtitle={t('profile.reviewHint')}
          leading={<IconBadge icon="moon" />}
          onPress={() => router.push('/review')}
        />
        <ListRow
          title={t('grades.title')}
          subtitle={t('profile.gradesHint')}
          leading={<IconBadge icon="award" color="success" background="successSoft" />}
          onPress={() => router.push('/grades')}
        />
        <ListRow
          title={t('study.title')}
          subtitle={t('profile.studyHint')}
          leading={<IconBadge icon="clock" />}
          onPress={() => router.push('/study')}
        />
        <ListRow
          title={t('stats.title')}
          subtitle={t('profile.statsHint')}
          leading={<IconBadge icon="bar-chart-2" color="warning" background="warningSoft" />}
          onPress={() => router.push('/stats')}
        />
      </Card>

      <SectionHeader title={t('profile.timetable')} />
      <Card>
        <ListRow
          title={t('calendar.timetables')}
          subtitle={t('profile.timetableHint')}
          leading={<IconBadge icon="calendar" />}
          onPress={() => router.push('/timetables')}
        />
      </Card>

      <SectionHeader title={t('profile.settings')} />
      <Card>
        <ListRow
          title={t('profile.settings')}
          subtitle={t('profile.settingsHint')}
          leading={<IconBadge icon="settings" />}
          onPress={() => router.push('/settings')}
        />
      </Card>

      <AppText variant="caption" color="muted" style={{ textAlign: 'center' }}>
        {t('profile.version', { version: Constants.expoConfig?.version ?? '' })}
      </AppText>
    </Screen>
  );
}
