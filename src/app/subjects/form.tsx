import { router, Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/components/navigation';
import { setPickedSubject } from '@/components/pickerResult';
import { EditLoadView } from '@/components/EditLoadView';
import { useEditLoad } from '@/hooks/useEditLoad';
import { useDirty, useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { createSubject, getSubject, updateSubject, type SubjectInput } from '@/modules/academic';
import { useDb } from '@/shared/db';
import { minTouchSize, subjectColors, useTheme } from '@/shared/theme';
import { FieldShell, FormScreen, TextField, fieldLimits, useSave, Tappable } from '@/shared/ui';

const empty: SubjectInput = {
  name: '',
  code: '',
  teacher: '',
  room: '',
  colorId: 'violet',
  semester: '',
  description: '',
};

export default function SubjectFormScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { colors, radius, scheme, spacing } = useTheme();
  const { id, from } = useLocalSearchParams<{ id?: string; from?: string }>();
  const [form, setForm] = useState<SubjectInput>(empty);
  const { errors, saving, run } = useSave();

  // Modification : les champs n'apparaissent qu'une fois la matière lue (jamais écrasés).
  const load = useEditLoad(
    id,
    (subjectId) => getSubject(db, subjectId),
    (s) => setForm({ ...s }),
  );
  const { dirty } = useDirty(form, load.state === 'ready');
  const leave = useUnsavedGuard(dirty);

  const set = (patch: Partial<SubjectInput>) => setForm((f) => ({ ...f, ...patch }));

  const submit = () =>
    run(async () => {
      if (id) {
        await updateSubject(db, id, form);
        leave(goBack);
      } else {
        const newId = await createSubject(db, form);
        // Créée depuis un autre formulaire (ex. un cours) : on y revient directement.
        if (from === 'picker') {
          setPickedSubject(newId);
          leave(goBack);
        } else leave(() => router.replace({ pathname: '/subjects/[id]', params: { id: newId } }));
      }
    });

  if (load.state !== 'ready')
    return <EditLoadView state={load.state} onRetry={load.retry} title={t('subjects.edit')} />;

  return (
    <FormScreen submitLabel={t('subjects.save')} onSubmit={submit} saving={saving}>
      <Stack.Screen options={{ title: id ? t('subjects.edit') : t('subjects.new') }} />
      <TextField
        label={t('subjects.name')}
        required
        value={form.name}
        onChangeText={(name) => set({ name })}
        error={errors.name}
        limit={fieldLimits.name80}
        placeholder={t('subjects.namePlaceholder')}
        autoFocus={!id}
        returnKeyType="next"
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
                onPress={() => set({ colorId: c.id })}
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
      <TextField
        label={t('subjects.teacher')}
        value={form.teacher ?? ''}
        onChangeText={(teacher) => set({ teacher })}
        error={errors.teacher}
        limit={fieldLimits.teacher}
        placeholder={t('common.optional')}
      />
      <TextField
        label={t('subjects.room')}
        value={form.room ?? ''}
        onChangeText={(room) => set({ room })}
        error={errors.room}
        limit={fieldLimits.room}
        placeholder={t('common.optional')}
      />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('subjects.code')}
            value={form.code ?? ''}
            onChangeText={(code) => set({ code })}
            error={errors.code}
            limit={fieldLimits.code}
            placeholder={t('common.optional')}
            autoCapitalize="characters"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('subjects.semester')}
            value={form.semester ?? ''}
            onChangeText={(semester) => set({ semester })}
            error={errors.semester}
            limit={fieldLimits.semester}
            placeholder={t('common.optional')}
          />
        </View>
      </View>
      <TextField
        label={t('subjects.description')}
        value={form.description ?? ''}
        onChangeText={(description) => set({ description })}
        error={errors.description}
        limit={fieldLimits.description500}
        placeholder={t('common.optional')}
        multiline
      />
    </FormScreen>
  );
}
