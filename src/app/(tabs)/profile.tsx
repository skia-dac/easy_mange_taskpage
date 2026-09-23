import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { useSubjects } from '@/hooks/useSubjects';
import { colorOf } from '@/modules/academic';
import { AppText, Card, IconBadge, ListRow, Screen, SectionHeader, SubjectDot } from '@/shared/ui';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { subjects } = useSubjects();

  return (
    <Screen title={t('profile.title')}>
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
