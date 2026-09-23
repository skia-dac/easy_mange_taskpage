import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, ScrollView, TextInput, View } from 'react-native';

import { NoteContent } from '@/components/NoteContent';
import { NoteEditor } from '@/components/NoteEditor';
import { subjectOptions } from '@/components/SubjectOptions';
import { useLabels } from '@/hooks/useLabels';
import { useSubjects } from '@/hooks/useSubjects';
import { colorOf } from '@/modules/academic';
import {
  attachmentExists,
  attachmentUri,
  deleteLocalFile,
  formatSize,
  pickDocument,
  pickImage,
} from '@/modules/platform';
import {
  addAttachment,
  createNote,
  deleteNote,
  getNote,
  listAttachments,
  removeAttachment,
  saveNoteContent,
  setNoteFavorite,
  toggleCheckbox,
  updateNote,
  type Attachment,
  type Note,
} from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { AppError, userMessageKey } from '@/shared/errors';
import { formatDate, formatShortDate } from '@/shared/format';
import { fonts, minTouchSize, useTheme } from '@/shared/theme';
import {
  AppText,
  Card,
  Chip,
  confirmDestructive,
  EmptyState,
  KeyboardAvoiding,
  SelectField,
  showError,
  TextButton,
} from '@/shared/ui';

type Params = { id: string; subjectId?: string; courseSeriesId?: string; courseDate?: string };

/**
 * Une note : lecture (cases cochables) ou édition (barre d'outils), avec enregistrement automatique.
 * `id = new` crée la note au premier contenu saisi (aucune note vide n'est créée si on ressort).
 */
export default function NoteScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { colors, radius, spacing } = useTheme();
  const params = useLocalSearchParams<Params>();
  const isNew = params.id === 'new';
  const { subjects, byId } = useSubjects();

  const [noteId, setNoteId] = useState<string | null>(isNew ? null : params.id);
  const [loaded, setLoaded] = useState(isNew);
  const [editing, setEditing] = useState(isNew);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(params.subjectId ?? null);
  const [favorite, setFavorite] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title: '', content: '' });
  const attachments = useLiveQuery(
    (d) => (noteId ? listAttachments(d, noteId) : Promise.resolve([] as Attachment[])),
    ['attachments'],
    [noteId],
  );

  const applyNote = (n: Note) => {
    setTitle(n.title);
    setContent(n.content);
    setSubjectId(n.subjectId);
    setFavorite(n.isFavorite);
    setUpdatedAt(n.updatedAt);
    latest.current = { title: n.title, content: n.content };
  };

  // Chargement d'une note existante ; pré-remplissage depuis un cours (§49).
  useEffect(() => {
    if (isNew) {
      if (params.subjectId && params.courseDate) {
        const s = byId.get(params.subjectId);
        if (s && !latest.current.title) {
          const prefilled = t('notes.courseTitle', {
            subject: s.name,
            date: formatShortDate(params.courseDate, labels.lang),
          });
          setTitle(prefilled);
          latest.current.title = prefilled;
        }
      }
      return;
    }
    void getNote(db, params.id).then((n) => {
      if (n) applyNote(n);
      setLoaded(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, params.id, isNew, byId]);

  const fail = (e: unknown) => {
    setStatus('idle');
    showError(
      e instanceof AppError && e.message === 'attachmentTooBig'
        ? 'notes.attachmentTooBig'
        : userMessageKey(e),
    );
  };

  /** Enregistrement (crée la note au premier contenu). Retourne l'id de la note. */
  const persist = useCallback(async (): Promise<string | null> => {
    const { title: tt, content: cc } = latest.current;
    if (!noteId) {
      if (tt.trim() === '' && cc.trim() === '') return null;
      setStatus('saving');
      const id = await createNote(db, {
        title: tt,
        content: cc,
        subjectId,
        courseSeriesId: params.courseSeriesId ?? null,
        courseDate: params.courseDate ?? null,
      });
      setNoteId(id);
      setStatus('saved');
      setUpdatedAt(new Date().toISOString());
      return id;
    }
    setStatus('saving');
    await saveNoteContent(db, noteId, tt, cc);
    setStatus('saved');
    setUpdatedAt(new Date().toISOString());
    return noteId;
  }, [db, noteId, subjectId, params.courseSeriesId, params.courseDate]);

  const scheduleSave = (next: { title?: string; content?: string }) => {
    if (next.title !== undefined) {
      setTitle(next.title);
      latest.current.title = next.title;
    }
    if (next.content !== undefined) {
      setContent(next.content);
      latest.current.content = next.content;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist().catch(fail), 600);
  };

  // Enregistre immédiatement quand on quitte l'écran (dernière version de persist, sans relancer l'effet).
  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);
  useEffect(() => {
    return function saveOnLeave() {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      void persistRef.current().catch(() => undefined);
    };
  }, []);

  const changeSubject = async (value: string | null) => {
    setSubjectId(value);
    if (!noteId) return;
    try {
      await updateNote(db, noteId, {
        title: latest.current.title,
        content: latest.current.content,
        subjectId: value,
        courseSeriesId: params.courseSeriesId ?? null,
        courseDate: params.courseDate ?? null,
      });
    } catch (e) {
      fail(e);
    }
  };

  const toggleFavorite = async () => {
    const id = noteId ?? (await persist().catch(fail));
    if (!id) return;
    setFavorite(!favorite);
    setNoteFavorite(db, id, !favorite).catch(fail);
  };

  const onToggleCheck = (line: number) => scheduleSave({ content: toggleCheckbox(content, line) });

  const attach = async (kind: 'image' | 'file') => {
    try {
      const id = noteId ?? (await persist());
      const target =
        id ??
        (await createNote(db, {
          title: latest.current.title,
          content: latest.current.content,
          subjectId,
        }));
      if (!noteId) setNoteId(target);
      const picked = kind === 'image' ? await pickImage(target) : await pickDocument(target);
      if (picked) await addAttachment(db, target, picked);
    } catch (e) {
      fail(e);
    }
  };

  const removeFile = async (a: Attachment) => {
    const ok = await confirmDestructive(
      a.name,
      t('notes.removeAttachment'),
      t('notes.removeAttachment'),
    );
    if (!ok) return;
    try {
      await removeAttachment(db, a.id);
      deleteLocalFile(a.localPath);
    } catch (e) {
      fail(e);
    }
  };

  const remove = async () => {
    if (!noteId) {
      router.back();
      return;
    }
    const ok = await confirmDestructive(
      t('notes.deleteTitle'),
      t('notes.deleteMessage'),
      t('common.delete'),
    );
    if (!ok) return;
    try {
      latest.current = { title: '', content: '' };
      const files = attachments.data ?? [];
      await deleteNote(db, noteId);
      files.forEach((a) => deleteLocalFile(a.localPath));
      setNoteId(null);
      router.back();
    } catch (e) {
      fail(e);
    }
  };

  if (!loaded) return null;
  if (!isNew && !noteId) return <EmptyState icon="alert-circle" title={t('errors.itemNotFound')} />;

  const subject = subjectId ? byId.get(subjectId) : undefined;
  const headerRight = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={favorite ? t('notes.unfavorite') : t('notes.favorite')}
        onPress={() => void toggleFavorite()}
        style={{
          width: minTouchSize,
          height: minTouchSize,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Feather name="star" size={22} color={favorite ? colors.warning : colors.muted} />
      </Pressable>
      <TextButton
        label={editing ? t('notes.done') : t('notes.edit')}
        onPress={() => setEditing(!editing)}
      />
    </View>
  );

  const files = attachments.data ?? [];
  const attachmentsBlock =
    files.length > 0 ? (
      <View style={{ gap: spacing.sm, padding: spacing.lg, paddingTop: 0 }}>
        <AppText variant="caption" color="muted">
          {t('notes.attachments')}
        </AppText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {files.map((a) => (
            <AttachmentTile
              key={a.id}
              attachment={a}
              onRemove={editing ? () => void removeFile(a) : undefined}
            />
          ))}
        </View>
      </View>
    ) : null;

  const meta = (
    <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
      {editing ? (
        <SelectField
          label={t('notes.subject')}
          value={subjectId}
          noneLabel={t('notes.noSubject')}
          options={subjectOptions(subjects)}
          onChange={(v) => void changeSubject(v)}
        />
      ) : (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}
        >
          {subject ? <Chip label={subject.name} subject={colorOf(subject)} /> : null}
          {updatedAt ? (
            <AppText variant="caption" color="muted">
              {t('notes.updated', {
                date: formatDate(toIsoDate(new Date(updatedAt)), labels.lang),
              })}
            </AppText>
          ) : null}
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <TextInput
          accessibilityLabel={t('notes.titlePlaceholder')}
          editable={editing}
          value={title}
          onChangeText={(v) => scheduleSave({ title: v })}
          placeholder={t('notes.titlePlaceholder')}
          placeholderTextColor={colors.muted}
          style={{
            flex: 1,
            fontFamily: fonts.display,
            fontSize: 24,
            lineHeight: 30,
            color: colors.text,
            paddingVertical: spacing.xs,
          }}
        />
        {status !== 'idle' ? (
          <AppText variant="caption" color={status === 'saved' ? 'success' : 'muted'}>
            {status === 'saved' ? t('notes.saved') : t('notes.saving')}
          </AppText>
        ) : null}
      </View>
    </View>
  );

  return (
    <KeyboardAvoiding>
      <Stack.Screen options={{ title: '', headerRight }} />
      {editing ? (
        <View style={{ flex: 1 }}>
          <View style={{ paddingTop: spacing.md }}>{meta}</View>
          <NoteEditor
            value={content}
            onChange={(v) => scheduleSave({ content: v })}
            placeholder={t('notes.contentPlaceholder')}
            autoFocus={isNew}
            extraActions={[
              { icon: 'image', label: t('notes.addImage'), onPress: () => void attach('image') },
              { icon: 'paperclip', label: t('notes.addFile'), onPress: () => void attach('file') },
            ]}
          />
          {attachmentsBlock}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingVertical: spacing.md,
            gap: spacing.lg,
            paddingBottom: spacing.xxl * 2,
          }}
        >
          {meta}
          <View style={{ paddingHorizontal: spacing.lg }}>
            <Card style={{ borderRadius: radius.lg }}>
              <NoteContent content={content} onToggleCheck={onToggleCheck} />
            </Card>
          </View>
          {attachmentsBlock}
          <TextButton label={t('notes.delete')} color="danger" onPress={() => void remove()} />
        </ScrollView>
      )}
    </KeyboardAvoiding>
  );
}

function AttachmentTile({
  attachment: a,
  onRemove,
}: {
  attachment: Attachment;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const exists = attachmentExists(a.localPath);
  const open = () => {
    if (!exists) {
      showError('notes.attachmentMissing');
      return;
    }
    void Linking.openURL(attachmentUri(a.localPath)).catch(() => showError('errors.generic'));
  };
  return (
    <View style={{ width: 132, gap: spacing.xs }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={a.name}
        onPress={open}
        style={{
          height: 96,
          borderRadius: radius.md,
          overflow: 'hidden',
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {a.kind === 'image' && exists ? (
          <Image
            source={{ uri: attachmentUri(a.localPath) }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            accessibilityLabel={a.name}
          />
        ) : (
          <Feather name={exists ? 'file' : 'alert-circle'} size={30} color={colors.primary} />
        )}
      </Pressable>
      <AppText variant="caption" numberOfLines={1}>
        {a.name}
      </AppText>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="caption" color="muted">
          {formatSize(a.size)}
        </AppText>
        {onRemove ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('notes.removeAttachment')} ${a.name}`}
            onPress={onRemove}
            hitSlop={10}
          >
            <AppText variant="caption" color="danger">
              {t('notes.removeAttachment')}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
