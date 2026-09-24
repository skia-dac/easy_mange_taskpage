import Feather from '@expo/vector-icons/Feather';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, TextInput, View } from 'react-native';

import {
  addSubtask,
  deleteSubtask,
  listSubtasks,
  moveSubtask,
  setSubtaskDone,
  subtaskProgress,
  type WorkKind,
} from '@/modules/productivity';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { minTouchSize, useTheme } from '@/shared/theme';
import { AppText, Card, Checkbox, showError } from '@/shared/ui';

/** Checklist d'une tâche ou d'un devoir : cocher, ajouter, monter / descendre, retirer. */
export function SubtaskList({ kind, workId }: { kind: WorkKind; workId: string }) {
  const { t } = useTranslation();
  const db = useDb();
  const { colors, spacing, radius, text } = useTheme();
  const list = useLiveQuery(
    (d) => listSubtasks(d, kind, workId),
    ['work_subtasks'],
    [kind, workId],
  );
  const [draft, setDraft] = useState('');
  const fail = (e: unknown) => showError(userMessageKey(e));
  const items = list.data ?? [];
  const progress = subtaskProgress(items);

  const add = () => {
    const title = draft.trim();
    if (!title) return;
    addSubtask(db, kind, workId, title).then(() => setDraft(''), fail);
  };

  const icon = (name: 'arrow-up' | 'arrow-down' | 'x', label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={{ width: 32, height: minTouchSize, alignItems: 'center', justifyContent: 'center' }}
    >
      <Feather name={name} size={18} color={colors.muted} />
    </Pressable>
  );

  return (
    <Card>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="bodyStrong">{t('subtasks.title')}</AppText>
        {progress.total > 0 ? (
          <AppText color="muted">
            {t('subtasks.progress', { done: progress.done, total: progress.total })}
          </AppText>
        ) : null}
      </View>
      {items.map((s, i) => (
        <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Checkbox
            checked={s.done}
            accessibilityLabel={s.title}
            onToggle={() => setSubtaskDone(db, s.id, !s.done).catch(fail)}
          />
          <AppText
            color={s.done ? 'muted' : 'text'}
            style={[{ flex: 1 }, s.done ? { textDecorationLine: 'line-through' } : null]}
          >
            {s.title}
          </AppText>
          {i > 0
            ? icon('arrow-up', t('subtasks.up'), () => moveSubtask(db, s.id, -1).catch(fail))
            : null}
          {i < items.length - 1
            ? icon('arrow-down', t('subtasks.down'), () => moveSubtask(db, s.id, 1).catch(fail))
            : null}
          {icon('x', t('subtasks.remove'), () => deleteSubtask(db, s.id).catch(fail))}
        </View>
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder={t('subtasks.placeholder')}
          placeholderTextColor={colors.muted}
          returnKeyType="done"
          accessibilityLabel={t('subtasks.add')}
          style={{
            flex: 1,
            minHeight: minTouchSize,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            color: colors.text,
            fontFamily: text.body.fontFamily,
            fontSize: 16,
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('subtasks.add')}
          onPress={add}
          style={{
            width: minTouchSize,
            height: minTouchSize,
            borderRadius: radius.md,
            backgroundColor: colors.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="plus" size={20} color={colors.primary} />
        </Pressable>
      </View>
    </Card>
  );
}
