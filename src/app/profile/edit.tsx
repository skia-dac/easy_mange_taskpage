import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { Stack } from 'expo-router';

import { goBack } from '@/components/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, View } from 'react-native';

import {
  getProfile,
  initials,
  saveProfile,
  setProfilePhoto,
  type ProfileInput,
} from '@/modules/identity';
import { attachmentUri, deleteLocalFile, pickImage } from '@/modules/platform';
import { useSpaces } from '@/shared/SpacesContext';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { useTheme } from '@/shared/theme';
import {
  AppText,
  confirmDestructive,
  FormScreen,
  showError,
  TextButton,
  TextField,
  useSave,
  reportLoadError,
} from '@/shared/ui';

/** Modification du profil (§6). */
export default function ProfileEditScreen() {
  const study = useSpaces().has('study');
  const { t } = useTranslation();
  const db = useDb();
  const { colors, spacing } = useTheme();
  const [form, setForm] = useState<ProfileInput>({
    firstName: '',
    lastName: '',
    university: '',
    field: '',
    level: '',
    academicYear: '',
  });
  const [photo, setPhoto] = useState<string | null>(null);
  const { errors, saving, run } = useSave();
  const set = (patch: Partial<ProfileInput>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    void getProfile(db)
      .then((p) => {
        if (!p) return;
        setForm({
          firstName: p.firstName,
          lastName: p.lastName,
          university: p.university,
          field: p.field,
          level: p.level,
          academicYear: p.academicYear,
        });
        setPhoto(p.photoPath);
      })
      .catch(reportLoadError);
  }, [db]);

  const submit = () =>
    run(async () => {
      await saveProfile(db, form);
      goBack();
    });

  const changePhoto = async () => {
    try {
      const picked = await pickImage('profile');
      if (!picked) return;
      if (photo) deleteLocalFile(photo);
      await setProfilePhoto(db, picked.localPath);
      setPhoto(picked.localPath);
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  const removePhoto = async () => {
    const ok = await confirmDestructive(
      t('profile.removePhotoTitle'),
      t('profile.removePhotoMessage'),
      t('common.delete'),
    );
    if (!ok) return;
    try {
      if (photo) deleteLocalFile(photo);
      await setProfilePhoto(db, null);
      setPhoto(null);
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  return (
    <FormScreen submitLabel={t('profile.save')} onSubmit={submit} saving={saving}>
      <Stack.Screen options={{ title: t('profile.edit') }} />
      <View style={{ alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.changePhoto')}
          onPress={() => void changePhoto()}
        >
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: 32,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {photo ? (
              <Image
                source={{ uri: attachmentUri(photo) }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
              />
            ) : initials(form as { firstName: string; lastName: string }) ? (
              <AppText variant="title" color="onPrimary">
                {initials(form as { firstName: string; lastName: string })}
              </AppText>
            ) : (
              <Feather name="user" size={40} color={colors.onPrimary} />
            )}
          </View>
        </Pressable>
        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <TextButton label={t('profile.changePhoto')} onPress={() => void changePhoto()} />
          {photo ? (
            <TextButton
              label={t('profile.removePhoto')}
              color="danger"
              onPress={() => void removePhoto()}
            />
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('profile.firstName')}
            value={form.firstName ?? ''}
            onChangeText={(firstName) => set({ firstName })}
            error={errors.firstName}
            autoFocus
            autoCapitalize="words"
          />
        </View>
        <View style={{ flex: 1 }}>
          <TextField
            label={t('profile.lastName')}
            value={form.lastName ?? ''}
            onChangeText={(lastName) => set({ lastName })}
            error={errors.lastName}
            autoCapitalize="words"
          />
        </View>
      </View>
      {/* Champs d'école : cachés sans l'espace Études, leurs valeurs restent enregistrées. */}
      {study ? (
        <>
          <TextField
            label={t('profile.university')}
            value={form.university ?? ''}
            onChangeText={(university) => set({ university })}
            error={errors.university}
            placeholder={t('common.optional')}
          />
          <TextField
            label={t('profile.field')}
            value={form.field ?? ''}
            onChangeText={(field) => set({ field })}
            error={errors.field}
            placeholder={t('common.optional')}
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('profile.level')}
                value={form.level ?? ''}
                onChangeText={(level) => set({ level })}
                error={errors.level}
                placeholder={t('common.optional')}
              />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label={t('profile.academicYear')}
                value={form.academicYear ?? ''}
                onChangeText={(academicYear) => set({ academicYear })}
                error={errors.academicYear}
                placeholder={t('profile.academicYearPlaceholder')}
              />
            </View>
          </View>
        </>
      ) : null}
    </FormScreen>
  );
}
