import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { useSubjects } from '@/hooks/useSubjects';
import { colorOf } from '@/modules/academic';
import { useTheme } from '@/shared/theme';
import { Card, EmptyState, IconBadge, ListRow, SubjectDot } from '@/shared/ui';

export default function SubjectsScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const { subjects, loading } = useSubjects();

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      <Stack.Screen options={{ title: t('subjects.title') }} />
      {!loading && subjects.length === 0 ? (
        <EmptyState icon="book-open" title={t('subjects.empty')} />
      ) : null}
      <Card>
        {subjects.map((s) => (
          <ListRow
            key={s.id}
            title={s.name}
            subtitle={[s.code, s.teacher, s.room, s.semester].filter(Boolean).join(' · ')}
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
    </ScrollView>
  );
}
