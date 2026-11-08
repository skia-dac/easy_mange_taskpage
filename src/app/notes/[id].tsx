import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';

import { goBack } from '@/components/navigation';
import { useUnsavedGuard } from '@/hooks/useUnsavedGuard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, TextInput, View } from 'react-native';

import { NOTE_TITLE_MAX } from '@/shared/fieldLimits';

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
  openLocalFile,
  pickDocument,
  pickImage,
  sharePdf,
} from '@/modules/platform';
import {
  addAttachment,
  createNote,
  deleteNote,
  getNote,
  listAttachments,
  listNoteCategories,
  NOTE_CONTENT_MAX,
  noteToHtml,
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
import { logger } from '@/shared/logger';
import { useSpaces } from '@/shared/SpacesContext';
import { formatDate, formatShortDate } from '@/shared/format';
import { minTouchSize, useTheme, variantMaxFontSizeMultiplier } from '@/shared/theme';
import {
  AppText,
  Card,
  Chip,
  ChoiceChips,
  confirmDestructive,
  EmptyState,
  KeyboardAvoiding,
  SelectField,
  showError,
  showToast,
  SubjectDot,
  TextButton,
  StateView,
  useInputProps,
  Tappable,
} from '@/shared/ui';

type Params = {
  id: string;
  subjectId?: string;
  courseSeriesId?: string;
  courseDate?: string;
  categoryId?: string;
};

type Snapshot = { title: string; content: string };

/**
 * Une note : lecture (cases cochables) ou édition (barre d'outils), avec enregistrement automatique.
 * `id = new` crée la note au premier contenu saisi (aucune note vide n'est créée si on ressort ;
 * un titre pré-rempli depuis un cours, laissé tel quel, ne compte pas comme du contenu).
 * Une note n'est réécrite que si son titre ou son texte a vraiment changé : la lire puis la
 * quitter ne change ni sa date ni sa place dans la liste.
 */
export default function NoteScreen() {
  const { t } = useTranslation();
  const labels = useLabels();
  const db = useDb();
  const { colors, radius, spacing, text } = useTheme();
  const inputProps = useInputProps();
  const params = useLocalSearchParams<Params>();
  const isNew = params.id === 'new';
  const { subjects, byId } = useSubjects();

  const [noteId, setNoteIdState] = useState<string | null>(isNew ? null : params.id);
  // Id lu de façon synchrone par l'autosave (l'état React arrive trop tard sous frappe rapide).
  const noteIdRef = useRef<string | null>(isNew ? null : params.id);
  const setNoteId = (id: string | null) => {
    noteIdRef.current = id;
    setNoteIdState(id);
  };
  /** Création en cours : les enregistrements suivants l'attendent au lieu de recréer une note. */
  const creating = useRef<Promise<string> | null>(null);
  // Lecture d'une note existante : en cours, en échec (avec « Réessayer »), introuvable, ou prête.
  const [loadState, setLoadState] = useState<'loading' | 'error' | 'missing' | 'ready'>(
    isNew ? 'ready' : 'loading',
  );
  const [reloadKey, setReloadKey] = useState(0);
  /**
   * Dernière version enregistrée (ou lue) du titre et du texte. `null` : rien n'est encore
   * enregistré, ou la note n'a pas pu être lue, et rien ne doit alors être écrit à sa place.
   */
  const persisted = useRef<Snapshot | null>(null);
  /** Titre proposé depuis un cours : seul, il ne suffit pas à créer la note. */
  const prefilledTitle = useRef<string | null>(null);
  const [editing, setEditing] = useState(isNew);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(params.subjectId ?? null);
  const spaces = useSpaces();
  // Notes communes aux trois espaces ; rangées par catégorie (créée par l'utilisateur).
  const [categoryId, setCategoryId] = useState<string | null>(params.categoryId ?? null);
  const categories = useLiveQuery(listNoteCategories, ['note_categories'], []);
  const [favorite, setFavorite] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  // L'enregistrement automatique a échoué : le texte affiché n'est pas enregistré.
  const [unsaved, setUnsaved] = useState(false);
  const leave = useUnsavedGuard(unsaved);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title: '', content: '' });
  /** Note supprimée : plus aucun enregistrement (sinon la sortie de l'écran la recréerait vide). */
  const deleted = useRef(false);
  // Message de l'enregistrement de sortie, lu après le démontage (dernière langue choisie).
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const attachments = useLiveQuery(
    (d) => (noteId ? listAttachments(d, noteId) : Promise.resolve([] as Attachment[])),
    ['attachments'],
    [noteId],
  );

  const applyNote = (n: Note) => {
    setTitle(n.title);
    setContent(n.content);
    setSubjectId(n.subjectId);
    setCategoryId(n.categoryId);
    setFavorite(n.isFavorite);
    setUpdatedAt(n.updatedAt);
    latest.current = { title: n.title, content: n.content };
    persisted.current = { title: n.title, content: n.content };
  };

  // Nouvelle note prise depuis un cours : titre proposé (§49), dès que la matière est connue.
  useEffect(() => {
    if (!isNew || !params.subjectId || !params.courseDate) return;
    const s = byId.get(params.subjectId);
    if (s && !latest.current.title) {
      const prefilled = t('notes.courseTitle', {
        subject: s.name,
        date: formatShortDate(params.courseDate, labels.lang),
      });
      setTitle(prefilled);
      latest.current.title = prefilled;
      prefilledTitle.current = prefilled;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew, byId]);

  // Chargement d'une note existante (et nouvel essai après un échec).
  useEffect(() => {
    if (isNew) return;
    let alive = true;
    getNote(db, params.id).then(
      (n) => {
        if (!alive) return;
        if (n) applyNote(n);
        setLoadState(n ? 'ready' : 'missing');
      },
      (e: unknown) => {
        // Écran « Réessayer » plutôt qu'un chargement sans fin ; rien n'est écrit tant que la
        // note n'a pas été lue (sinon la sortie l'enregistrerait vide).
        logger.error(e, { where: 'note.load' });
        if (alive) setLoadState('error');
      },
    );
    return () => {
      alive = false;
    };
  }, [db, params.id, isNew, reloadKey]);

  const fail = (e: unknown) => {
    setStatus('idle');
    showError(
      e instanceof AppError && e.message === 'attachmentTooBig'
        ? 'notes.attachmentTooBig'
        : userMessageKey(e),
    );
  };

  /**
   * Enregistrement (crée la note au premier contenu). Retourne l'id de la note, ou `null` si
   * rien n'est à enregistrer. `explicit` : l'utilisateur agit sur la note (favori…), le titre
   * pré-rempli suffit alors à la créer.
   */
  const persist = useCallback(
    async (explicit = false): Promise<string | null> => {
      if (deleted.current) return null;
      if (!noteIdRef.current && !creating.current) {
        const snapshot = { ...latest.current };
        const { title: tt, content: cc } = snapshot;
        const typedTitle = tt.trim() !== '' && (explicit || tt !== prefilledTitle.current);
        if (cc.trim() === '' && !typedTitle) return null;
        setStatus('saving');
        creating.current = createNote(db, {
          title: tt,
          content: cc,
          subjectId,
          courseSeriesId: params.courseSeriesId ?? null,
          courseDate: params.courseDate ?? null,
          categoryId,
        })
          .then((id) => {
            persisted.current = snapshot;
            return id;
          })
          .finally(() => {
            creating.current = null;
          });
        const id = await creating.current;
        setNoteId(id);
        setStatus('saved');
        setUpdatedAt(new Date().toISOString());
        return id;
      }
      // Une création est en cours (frappe rapide) : on l'attend, puis on enregistre la dernière version.
      const id = noteIdRef.current ?? (await creating.current!);
      noteIdRef.current = id;
      // Note pas encore lue (ou lecture en échec) : rien à enregistrer, surtout pas un texte vide.
      const before = persisted.current;
      if (!before) return null;
      const snapshot = { ...latest.current };
      if (snapshot.title === before.title && snapshot.content === before.content) return id;
      setStatus('saving');
      await saveNoteContent(db, id, snapshot.title, snapshot.content);
      persisted.current = snapshot;
      setStatus('saved');
      setUpdatedAt(new Date().toISOString());
      return id;
    },
    [db, subjectId, categoryId, params.courseSeriesId, params.courseDate],
  );

  /** Enregistrement automatique : un échec s'affiche une seule fois, sous le titre, sans alerte. */
  const autosave = useCallback(() => {
    persist().then(
      () => setUnsaved(false),
      (e: unknown) => {
        logger.error(e, { where: 'note.autosave' });
        setStatus('idle');
        setUnsaved(true);
      },
    );
  }, [persist]);

  const scheduleSave = (next: { title?: string; content?: string }) => {
    if (next.title !== undefined) {
      setTitle(next.title);
      latest.current.title = next.title;
    }
    if (next.content !== undefined) {
      // Au-delà de la limite, l'enregistrement serait refusé à chaque frappe : le texte est coupé
      // avant d'être enregistré (collage d'un très long texte).
      const clipped = next.content.slice(0, NOTE_CONTENT_MAX);
      setContent(clipped);
      latest.current.content = clipped;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // Après un échec, chaque nouvelle modification retente l'enregistrement (sans nouvelle alerte).
    saveTimer.current = setTimeout(autosave, 600);
  };

  const retrySave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    autosave();
  };

  // Enregistre immédiatement quand on quitte l'écran (dernière version de persist, sans relancer l'effet).
  const persistRef = useRef(persist);
  useEffect(() => {
    persistRef.current = persist;
  }, [persist]);
  useEffect(() => {
    return function saveOnLeave() {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      // L'écran se ferme : un échec ne peut plus s'afficher sous le titre, on le dit par un toast.
      void persistRef.current().catch((e: unknown) => {
        logger.error(e, { where: 'note.saveOnLeave' });
        showToast(tRef.current('notes.saveFailed'));
      });
    };
  }, []);

  const saveMeta = async (next: { subjectId: string | null; categoryId: string | null }) => {
    if (!noteId) return;
    const snapshot = { ...latest.current };
    try {
      await updateNote(db, noteId, {
        title: snapshot.title,
        content: snapshot.content,
        subjectId: next.subjectId,
        courseSeriesId: params.courseSeriesId ?? null,
        courseDate: params.courseDate ?? null,
        categoryId: next.categoryId,
      });
      persisted.current = snapshot;
    } catch (e) {
      fail(e);
    }
  };

  const changeSubject = async (value: string | null) => {
    setSubjectId(value);
    await saveMeta({ subjectId: value, categoryId });
  };

  const changeCategory = async (value: string | null) => {
    setCategoryId(value);
    await saveMeta({ subjectId, categoryId: value });
  };

  const toggleFavorite = async () => {
    const id = noteId ?? (await persist(true).catch(fail));
    if (!id) return;
    setFavorite(!favorite);
    setNoteFavorite(db, id, !favorite).catch(fail);
  };

  const onToggleCheck = (line: number) => scheduleSave({ content: toggleCheckbox(content, line) });

  const attach = async (kind: 'image' | 'file') => {
    try {
      const id = noteId ?? (await persist(true));
      const target =
        id ??
        (await createNote(db, {
          title: latest.current.title,
          content: latest.current.content,
          subjectId,
          categoryId,
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

  const sharePdfFile = async () => {
    const html = noteToHtml(content, {
      title: title.trim() || t('notes.untitled'),
      subtitle: subjectId ? byId.get(subjectId)?.name : undefined,
      footer: t('notes.pdfFooter', { date: formatDate(toIsoDate(new Date()), labels.lang) }),
    });
    try {
      if (!(await sharePdf(html, title, t('notes.sharePdf')))) showError('backup.shareUnavailable');
    } catch (e) {
      fail(e);
    }
  };

  const remove = async () => {
    if (!noteId) {
      leave(goBack);
      return;
    }
    const ok = await confirmDestructive(
      t('notes.deleteTitle'),
      t('notes.deleteMessage'),
      t('common.delete'),
    );
    if (!ok) return;
    // Un enregistrement en attente ne doit pas partir après la suppression.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      const files = attachments.data ?? [];
      await deleteNote(db, noteId);
      // Seulement une fois la suppression réussie : en cas d'échec, le texte reste intact et
      // l'enregistrement de sortie garde la note telle quelle (jamais une note vidée).
      deleted.current = true;
      files.forEach((a) => deleteLocalFile(a.localPath));
      setNoteId(null);
      leave(goBack);
    } catch (e) {
      fail(e);
    }
  };

  if (loadState === 'loading' || loadState === 'error') {
    return (
      <View style={{ flex: 1, padding: spacing.lg }}>
        <Stack.Screen options={{ title: t('notes.screenTitle') }} />
        <StateView
          state={loadState}
          onRetry={() => {
            setLoadState('loading');
            setReloadKey((k) => k + 1);
          }}
        />
      </View>
    );
  }
  if (loadState === 'missing' || (!isNew && !noteId)) {
    return (
      <View style={{ flex: 1 }}>
        <Stack.Screen options={{ title: t('notes.screenTitle') }} />
        <EmptyState
          icon="alert-circle"
          title={t('notes.notFound')}
          message={t('notes.notFoundHint')}
          action={{ label: t('common.back'), onPress: () => goBack() }}
        />
      </View>
    );
  }

  const subject = subjectId ? byId.get(subjectId) : undefined;
  const category = (categories.data ?? []).find((c) => c.id === categoryId);
  const headerRight = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <Tappable
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
      </Tappable>
      {noteId && !editing ? (
        <Tappable
          accessibilityRole="button"
          accessibilityLabel={t('notes.sharePdf')}
          onPress={() => void sharePdfFile()}
          style={{
            width: minTouchSize,
            height: minTouchSize,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Feather name="share" size={22} color={colors.muted} />
        </Tappable>
      ) : null}
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
        <>
          <ChoiceChips
            label={t('noteCategories.field')}
            scroll
            options={[
              { value: null as string | null, label: t('noteCategories.none') },
              ...(categories.data ?? []).map((c) => ({
                value: c.id as string | null,
                label: c.name,
                leading: <SubjectDot color={colorOf({ colorId: c.colorId })} size={10} />,
              })),
              { value: '__new', label: t('noteCategories.new') },
            ]}
            selected={[categoryId]}
            onToggle={(v) =>
              v === '__new' ? router.push('/notes/category-form') : void changeCategory(v)
            }
          />
          {spaces.has('study') ? (
            <SelectField
              label={t('notes.subject')}
              value={subjectId}
              noneLabel={t('notes.noSubject')}
              options={subjectOptions(subjects)}
              onChange={(v) => void changeSubject(v)}
            />
          ) : null}
        </>
      ) : (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}
        >
          {subject ? <Chip label={subject.name} subject={colorOf(subject)} /> : null}
          {category ? (
            <Chip label={category.name} subject={colorOf({ colorId: category.colorId })} />
          ) : null}
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
          maxLength={NOTE_TITLE_MAX}
          placeholder={t('notes.titlePlaceholder')}
          {...inputProps}
          maxFontSizeMultiplier={variantMaxFontSizeMultiplier.headline}
          style={{
            flex: 1,
            ...text.headline,
            color: colors.text,
            paddingVertical: spacing.xs,
          }}
        />
        {unsaved && status !== 'saving' ? (
          // Échec de l'enregistrement automatique : indiqué une fois, ici, sans alerte bloquante ;
          // la prochaine modification (ou un appui) retente.
          <Tappable
            accessibilityRole="button"
            accessibilityLabel={t('notes.unsavedRetryLabel')}
            accessibilityLiveRegion="polite"
            onPress={retrySave}
            style={{ minHeight: minTouchSize, justifyContent: 'center' }}
          >
            <AppText variant="caption" color="danger">
              {t('notes.unsavedRetry')}
            </AppText>
          </Tappable>
        ) : status !== 'idle' ? (
          <AppText variant="caption" color={status === 'saved' ? 'success' : 'muted'}>
            {status === 'saved' ? t('notes.saved') : t('notes.saving')}
          </AppText>
        ) : null}
      </View>
    </View>
  );

  return (
    <KeyboardAvoiding>
      <Stack.Screen options={{ title: t('notes.screenTitle'), headerRight }} />
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
    openLocalFile(attachmentUri(a.localPath), a.mimeType, a.name)
      .then((ok) => {
        if (!ok) showToast(t('notes.attachmentCannotOpen'));
      })
      .catch((e: unknown) => {
        logger.error(e, { where: 'note.openAttachment' });
        showToast(t('notes.attachmentCannotOpen'));
      });
  };
  return (
    <View style={{ width: 132, gap: spacing.xs }}>
      <Tappable
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
      </Tappable>
      <AppText variant="caption" numberOfLines={1}>
        {a.name}
      </AppText>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <AppText variant="caption" color="muted">
          {formatSize(a.size)}
        </AppText>
        {onRemove ? (
          <Tappable
            accessibilityRole="button"
            accessibilityLabel={`${t('notes.removeAttachment')} ${a.name}`}
            onPress={onRemove}
            // Zone tactile d'au moins 44 pt, même si le texte est petit.
            style={{
              minHeight: minTouchSize,
              minWidth: minTouchSize,
              alignItems: 'flex-end',
              justifyContent: 'center',
            }}
          >
            <AppText variant="caption" color="danger">
              {t('notes.removeAttachment')}
            </AppText>
          </Tappable>
        ) : null}
      </View>
    </View>
  );
}
