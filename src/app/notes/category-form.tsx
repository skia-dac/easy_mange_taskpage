import { Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/components/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  createNoteCategory,
  deleteNoteCategory,
  getNoteCategory,
  updateNoteCategory,
  type NoteCategoryInput,
} from '@/modules/productivity';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { subjectColors, useTheme } from '@/shared/theme';
import {
  confirmDestructive,
  FieldShell,
  FormScreen,
  showError,
  TextButton,
  TextField,
  useSave,
  reportLoadError,
} from '@/shared/ui';

/** Créer, renommer ou supprimer une catégorie de notes (ses notes sont gardées). */
export default function NoteCategoryFormScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { colors, scheme } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [form, setForm] = useState<NoteCategoryInput>({ name: '', colorId: 'blue' });
  const { errors, saving, run } = useSave();

  useEffect(() => {
    if (!id) return;
    void getNoteCategory(db, id)
      .then((c) => c && setForm({ name: c.name, colorId: c.colorId }))
      .catch(reportLoadError);
  }, [db, id]);

  const submit = () =>
    run(async () => {
      if (id) await updateNoteCategory(db, id, form);
      else await createNoteCategory(db, form);
      goBack();
    });

  const remove = async () => {
    if (!id) return;
    const ok = await confirmDestructive(
      t('noteCategories.deleteTitle', { name: form.name }),
      t('noteCategories.deleteMessage'),
      t('common.delete'),
    );
    if (!ok) return;
    try {
      await deleteNoteCategory(db, id);
      goBack();
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  return (
    <FormScreen
      submitLabel={t('common.save')}
      onSubmit={submit}
      saving={saving}
      footer={
        id ? (
          <TextButton
            label={t('noteCategories.delete')}
            color="danger"
            onPress={() => void remove()}
          />
        ) : undefined
      }
    >
      <Stack.Screen options={{ title: id ? t('noteCategories.edit') : t('noteCategories.new') }} />
      <TextField
        label={t('noteCategories.name')}
        required
        value={form.name}
        onChangeText={(name) => setForm((f) => ({ ...f, name }))}
        error={errors.name}
        placeholder={t('noteCategories.namePlaceholder')}
        autoFocus={!id}
      />
      <FieldShell label={t('subjects.color')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {subjectColors.map((c, i) => {
            const selected = form.colorId === c.id;
            return (
              <Pressable
                key={c.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t('subjects.colorName', { n: i + 1 })}
                onPress={() => setForm((f) => ({ ...f, colorId: c.id }))}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: scheme === 'dark' ? c.strongDark : c.strong,
                  borderWidth: selected ? 3 : 0,
                  borderColor: colors.text,
                }}
              />
            );
          })}
        </View>
      </FieldShell>
    </FormScreen>
  );
}
