import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colorOf } from '@/modules/academic';
import { listNoteCategories, listNotes } from '@/modules/productivity';
import { useLiveQuery } from '@/shared/db';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Fab,
  FAB_CLEARANCE,
  ListRow,
  SubjectDot,
} from '@/shared/ui';

/** Catégories de notes (créées par l'utilisateur) : les notes sont communes aux trois espaces. */
export default function NoteCategoriesScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const categories = useLiveQuery(listNoteCategories, ['note_categories'], []);
  const notes = useLiveQuery(listNotes, ['notes'], []);
  const count = (id: string) => (notes.data ?? []).filter((n) => n.categoryId === id).length;

  const list = categories.data ?? [];
  const add = () => router.push('/notes/category-form');

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{
          padding: spacing.xl,
          gap: spacing.lg,
          paddingBottom: FAB_CLEARANCE + insets.bottom,
        }}
      >
        <Stack.Screen options={{ title: t('noteCategories.title') }} />
        <AppText color="muted">{t('noteCategories.intro')}</AppText>
        {!categories.loading && list.length === 0 ? (
          <>
            <EmptyState
              icon="folder"
              title={t('noteCategories.empty')}
              message={t('noteCategories.emptyHint')}
            />
            <Button label={t('noteCategories.new')} onPress={add} />
          </>
        ) : null}
        {list.length > 0 ? (
          <Card>
            {list.map((c) => (
              <ListRow
                key={c.id}
                title={c.name}
                subtitle={t('noteCategories.count', { count: count(c.id) })}
                leading={<SubjectDot color={colorOf({ colorId: c.colorId })} size={14} />}
                onPress={() =>
                  router.push({ pathname: '/notes/category-form', params: { id: c.id } })
                }
              />
            ))}
          </Card>
        ) : null}
      </ScrollView>
      <Fab accessibilityLabel={t('noteCategories.new')} onPress={add} />
    </View>
  );
}
