import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSubjects } from '@/hooks/useSubjects';
import { colorOf } from '@/modules/academic';
import { useTheme } from '@/shared/theme';
import { Button, Card, EmptyState, Fab, FAB_CLEARANCE, ListRow, SubjectDot } from '@/shared/ui';

export default function SubjectsScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { subjects, loading } = useSubjects();
  const add = () => router.push('/subjects/form');

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          gap: spacing.lg,
          paddingBottom: FAB_CLEARANCE + insets.bottom,
        }}
      >
        <Stack.Screen options={{ title: t('subjects.title') }} />
        {!loading && subjects.length === 0 ? (
          <>
            <EmptyState icon="book-open" title={t('subjects.empty')} />
            <Button label={t('profile.addSubject')} onPress={add} />
          </>
        ) : null}
        {subjects.length > 0 ? (
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
          </Card>
        ) : null}
      </ScrollView>
      <Fab accessibilityLabel={t('subjects.new')} onPress={add} />
    </View>
  );
}
