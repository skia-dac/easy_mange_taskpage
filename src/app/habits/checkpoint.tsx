import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import {
  attachmentExists,
  attachmentUri,
  deleteLocalFile,
  pickImage,
  takePhoto,
} from '@/modules/platform';
import {
  createCheckpoint,
  deleteCheckpoint,
  getCheckpoint,
  listCheckpoints,
  updateCheckpoint,
} from '@/modules/productivity';
import { toIsoDate } from '@/shared/dates';
import { useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { ValidationError } from '@/shared/validation';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  Button,
  confirmDestructive,
  DateTimeField,
  FormScreen,
  showError,
  TextButton,
  TextField,
  useSave,
  reportLoadError,
} from '@/shared/ui';

/** Lit « 72,5 » ou « 72.5 » ; texte vide = pas de poids. */
function parseWeight(text: string): number | null | undefined {
  const t = text.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Point de suivi physique : photo (appareil photo ou galerie) et poids. Le premier est le point
 * de départ. La photo reste dans le dossier privé de l'app, sur ce téléphone.
 */
export default function CheckpointScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const { colors, radius, spacing } = useTheme();
  const { habitId, id } = useLocalSearchParams<{ habitId: string; id?: string }>();
  const existing = useLiveQuery(
    (d) => listCheckpoints(d, habitId),
    ['habit_checkpoints'],
    [habitId],
  );
  const [date, setDate] = useState(toIsoDate(new Date()));
  const [weight, setWeight] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [initialPhoto, setInitialPhoto] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const { errors, saving, run } = useSave();
  // Photo prise mais pas enregistrée : effacée quand on quitte l'écran (rien ne traîne).
  const pending = useRef<{ photo: string | null; initial: string | null; saved: boolean }>({
    photo: null,
    initial: null,
    saved: false,
  });
  useEffect(() => {
    pending.current.photo = photoPath;
    pending.current.initial = initialPhoto;
  }, [photoPath, initialPhoto]);
  useEffect(
    () => () => {
      const p = pending.current;
      if (!p.saved && p.photo && p.photo !== p.initial) deleteLocalFile(p.photo);
    },
    [],
  );

  useEffect(() => {
    if (!id) return;
    void getCheckpoint(db, id)
      .then((c) => {
        if (!c) return;
        setDate(c.date);
        setWeight(c.weightKg === null ? '' : String(c.weightKg).replace('.', ','));
        setPhotoPath(c.photoPath);
        setInitialPhoto(c.photoPath);
        setNote(c.note ?? '');
      })
      .catch(reportLoadError);
  }, [db, id]);

  const isStart = !id && (existing.data ?? []).length === 0;
  const folder = `progress/${habitId}`;

  const replacePhoto = async (pick: typeof takePhoto) => {
    try {
      const picked = await pick(folder);
      if (!picked) return;
      // Une photo prise puis remplacée avant d'enregistrer ne doit pas rester sur le téléphone.
      if (photoPath && photoPath !== initialPhoto) deleteLocalFile(photoPath);
      setPhotoPath(picked.localPath);
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  const submit = () =>
    run(async () => {
      const weightKg = parseWeight(weight);
      // Une ValidationError s'affiche sous le champ (un setErrors serait effacé par run).
      if (weightKg === undefined)
        throw new ValidationError({ weightKg: 'validation.invalidWeight' });
      const input = { habitId, date, weightKg, photoPath, note };
      if (id) await updateCheckpoint(db, id, input);
      else await createCheckpoint(db, input);
      pending.current.saved = true;
      if (initialPhoto && initialPhoto !== photoPath) deleteLocalFile(initialPhoto);
      router.back();
    });

  const remove = async () => {
    if (!id) return;
    const ok = await confirmDestructive(
      t('bodyProgress.deleteTitle'),
      t('bodyProgress.deleteMessage'),
      t('common.delete'),
    );
    if (!ok) return;
    try {
      await deleteCheckpoint(db, id);
      pending.current.saved = true;
      if (initialPhoto) deleteLocalFile(initialPhoto);
      if (photoPath && photoPath !== initialPhoto) deleteLocalFile(photoPath);
      router.back();
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  const hasPhoto = !!photoPath && attachmentExists(photoPath);

  return (
    <FormScreen
      submitLabel={t('common.save')}
      onSubmit={submit}
      saving={saving}
      footer={
        id ? (
          <TextButton
            label={t('bodyProgress.delete')}
            color="danger"
            onPress={() => void remove()}
          />
        ) : undefined
      }
    >
      <Stack.Screen
        options={{
          title: isStart
            ? t('bodyProgress.startTitle')
            : id
              ? t('bodyProgress.editTitle')
              : t('bodyProgress.newTitle'),
        }}
      />
      <AppText color="muted">
        {isStart ? t('bodyProgress.startIntro') : t('bodyProgress.newIntro')}
      </AppText>

      <View
        style={{
          height: 280,
          borderRadius: radius.lg,
          backgroundColor: colors.background,
          borderWidth: 1,
          borderColor: colors.border,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {hasPhoto && photoPath ? (
          <Image
            accessibilityLabel={t('bodyProgress.photo')}
            source={{ uri: attachmentUri(photoPath) }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
          />
        ) : (
          <AppText color="muted">{t('bodyProgress.noPhoto')}</AppText>
        )}
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button
            label={t('bodyProgress.takePhoto')}
            onPress={() => void replacePhoto(takePhoto)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            variant="secondary"
            label={t('bodyProgress.choosePhoto')}
            onPress={() => void replacePhoto(pickImage)}
          />
        </View>
      </View>
      {photoPath ? (
        <TextButton
          label={t('bodyProgress.removePhoto')}
          color="danger"
          onPress={() => {
            if (photoPath !== initialPhoto) deleteLocalFile(photoPath);
            setPhotoPath(null);
          }}
        />
      ) : null}
      <AppText variant="caption" color="muted">
        {t('bodyProgress.privacy')}
      </AppText>

      <TextField
        label={t('bodyProgress.weight')}
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        placeholder={t('bodyProgress.weightPlaceholder')}
        error={errors.weightKg}
      />
      <DateTimeField
        label={t('bodyProgress.date')}
        mode="date"
        required
        value={date}
        onChange={(v) => v && setDate(v)}
        error={errors.date}
      />
      <TextField
        label={t('bodyProgress.note')}
        value={note}
        onChangeText={setNote}
        placeholder={t('common.optional')}
        maxLength={300}
        error={errors.note}
      />
    </FormScreen>
  );
}
