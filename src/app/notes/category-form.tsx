import { Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/components/navigation';
import { EditLoadView } from '@/components/EditLoadView';
import { useEditLoad } from '@/hooks/useEditLoad';
import { useDirty, useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  createNoteCategory,
  deleteNoteCategory,
  getNoteCategory,
  updateNoteCategory,
  type NoteCategoryInput,
} from '@/modules/productivity';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { minTouchSize, subjectColors, useTheme } from '@/shared/theme';
import {
  confirmDestructive,
  FieldShell,
  FormScreen,
  showError,
  TextButton,
  TextField,
  fieldLimits,
  useSave,
  Tappable,
} from '@/shared/ui';

/** Créer, renommer ou supprimer une catégorie de notes (ses notes sont gardées). */
export default function NoteCategoryFormScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { colors, radius, scheme, spacing } = useTheme();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [form, setForm] = useState<NoteCategoryInput>({ name: '', colorId: 'blue' });
  const { errors, saving, run } = useSave();

  // Modification : les champs n'apparaissent qu'une fois la catégorie lue (jamais écrasés).
  const load = useEditLoad(
    id,
    (categoryId) => getNoteCategory(db, categoryId),
    (c) => setForm({ name: c.name, colorId: c.colorId }),
  );
  const { dirty } = useDirty(form, load.state === 'ready');
  const leave = useUnsavedGuard(dirty);

  const submit = () =>
    run(async () => {
      if (id) await updateNoteCategory(db, id, form);
      else await createNoteCategory(db, form);
      leave(goBack);
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
      leave(goBack);
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  if (load.state !== 'ready')
    return (
      <EditLoadView state={load.state} onRetry={load.retry} title={t('noteCategories.edit')} />
    );

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
        limit={fieldLimits.name40}
        placeholder={t('noteCategories.namePlaceholder')}
        autoFocus={!id}
      />
      <FieldShell label={t('subjects.color')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
          {subjectColors.map((c, i) => {
            const selected = form.colorId === c.id;
            return (
              <Tappable
                key={c.id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t('subjects.colorName', { n: i + 1 })}
                onPress={() => setForm((f) => ({ ...f, colorId: c.id }))}
                style={{
                  width: minTouchSize,
                  height: minTouchSize,
                  borderRadius: radius.pill,
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
