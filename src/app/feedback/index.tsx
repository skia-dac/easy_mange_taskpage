import Feather from '@expo/vector-icons/Feather';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Switch, View } from 'react-native';

import { goBack } from '@/components/navigation';
import { getSupabase, useAuth } from '@/modules/identity';
import {
  attachmentUri,
  deleteLocalFile,
  FEEDBACK_AREAS,
  FEEDBACK_FOLDER,
  FEEDBACK_KINDS,
  feedbackContext,
  MESSAGE_MAX,
  pickImage,
  safeErrorName,
  submitFeedback,
  type FeedbackArea,
  type FeedbackKind,
} from '@/modules/platform';
import { useDb } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { useSpaces } from '@/shared/SpacesContext';
import { minTouchSize, useTheme } from '@/shared/theme';
import {
  AppText,
  ChoiceChips,
  FieldShell,
  FormScreen,
  showError,
  showToast,
  TextButton,
  TextField,
  useSave,
} from '@/shared/ui';

const KIND_ICONS: Record<FeedbackKind, ComponentProps<typeof Feather>['name']> = {
  bug: 'alert-triangle',
  idea: 'zap',
  other: 'message-circle',
};

const asKind = (v: string | undefined): FeedbackKind | null =>
  (FEEDBACK_KINDS as readonly string[]).includes(v ?? '') ? (v as FeedbackKind) : null;
const asArea = (v: string | undefined): FeedbackArea =>
  (FEEDBACK_AREAS as readonly string[]).includes(v ?? '') ? (v as FeedbackArea) : 'other';

/** « Donner mon avis » : un bug, une idée ou autre chose, en un seul écran. */
export default function FeedbackScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const auth = useAuth();
  const spaces = useSpaces();
  const { colors, radius, spacing } = useTheme();
  const params = useLocalSearchParams<{ kind?: string; area?: string; error?: string }>();
  const [kind, setKind] = useState<FeedbackKind | null>(() => asKind(params.kind));
  const [area, setArea] = useState<FeedbackArea>(() => asArea(params.area));
  const [message, setMessage] = useState('');
  const [blocking, setBlocking] = useState(false);
  // null = pas encore touché : l'e-mail du compte est proposé (même s'il arrive après l'ouverture).
  const [typedEmail, setContactEmail] = useState<string | null>(null);
  const contactEmail = typedEmail ?? auth.email ?? '';
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const errorName = safeErrorName(params.error);
  const { errors, saving, run } = useSave();
  const context = useMemo(() => feedbackContext(), []);
  const server = getSupabase();

  // Capture choisie puis écran quitté sans envoyer : le fichier copié est effacé.
  const pending = useRef<string | null>(null);
  useEffect(() => () => void (pending.current && deleteLocalFile(pending.current)), []);
  const replaceScreenshot = (next: string | null) => {
    if (pending.current && pending.current !== next) deleteLocalFile(pending.current);
    pending.current = next;
    setScreenshot(next);
  };

  const areas = FEEDBACK_AREAS.filter(
    (a) => (a !== 'money' || spaces.has('personal')) && (a !== 'revision' || spaces.has('study')),
  );

  const addScreenshot = async () => {
    try {
      const picked = await pickImage(FEEDBACK_FOLDER);
      if (picked) replaceScreenshot(picked.localPath);
    } catch (e) {
      showError(userMessageKey(e));
    }
  };

  const submit = () =>
    run(async () => {
      const { outcome } = await submitFeedback(
        db,
        {
          kind,
          area,
          message,
          blocking,
          contactEmail,
          screenshotPath: screenshot,
          errorName,
        },
        server,
      );
      pending.current = null; // la capture appartient maintenant au retour enregistré
      if (outcome === 'mailFailed') {
        showError('feedback.mailFailed');
        return goBack();
      }
      showToast(t(outcome === 'queued' ? 'feedback.queued' : 'feedback.thanks'));
      goBack();
    });

  const placeholder = t(`feedback.placeholder.${kind ?? 'other'}`);

  return (
    <FormScreen
      submitLabel={server ? t('feedback.send') : t('feedback.sendByMail')}
      onSubmit={() => void submit()}
      saving={saving}
    >
      <Stack.Screen options={{ title: t('feedback.title') }} />

      <FieldShell label={t('feedback.kindLabel')} required error={errors.kind}>
        <View accessibilityRole="radiogroup" style={{ gap: spacing.sm }}>
          {FEEDBACK_KINDS.map((k) => {
            const on = kind === k;
            return (
              <Pressable
                key={k}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${t(`feedback.kind.${k}.title`)}. ${t(`feedback.kind.${k}.hint`)}`}
                onPress={() => setKind(k)}
                style={({ pressed }) => ({
                  minHeight: minTouchSize + 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.md,
                  borderRadius: radius.lg,
                  borderWidth: 1.5,
                  borderColor: on ? colors.primary : colors.border,
                  backgroundColor: on ? colors.primarySoft : colors.surface,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.sm,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? colors.primary : colors.primarySoft,
                  }}
                >
                  <Feather
                    name={KIND_ICONS[k]}
                    size={20}
                    color={on ? colors.onPrimary : colors.primary}
                  />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="bodyStrong">{t(`feedback.kind.${k}.title`)}</AppText>
                  <AppText variant="caption" color="muted">
                    {t(`feedback.kind.${k}.hint`)}
                  </AppText>
                </View>
                <Feather
                  name={on ? 'check-circle' : 'circle'}
                  size={22}
                  color={on ? colors.primary : colors.border}
                />
              </Pressable>
            );
          })}
        </View>
      </FieldShell>

      <ChoiceChips
        label={t('feedback.areaLabel')}
        options={areas.map((a) => ({ value: a, label: t(`feedback.area.${a}`) }))}
        selected={[area]}
        onToggle={setArea}
      />

      <View style={{ gap: spacing.xs }}>
        <TextField
          label={t('feedback.messageLabel')}
          required
          multiline
          value={message}
          onChangeText={setMessage}
          maxLength={MESSAGE_MAX}
          placeholder={placeholder}
          error={errors.message}
          style={{ minHeight: 140 }}
        />
        <AppText
          variant="caption"
          color="muted"
          style={{ textAlign: 'right' }}
          accessibilityLabel={t('feedback.counter', { count: message.length, max: MESSAGE_MAX })}
        >
          {t('feedback.counter', { count: message.length, max: MESSAGE_MAX })}
        </AppText>
      </View>

      {kind === 'bug' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <AppText variant="bodyStrong" style={{ flex: 1 }}>
            {t('feedback.blocking')}
          </AppText>
          <Switch
            accessibilityLabel={t('feedback.blocking')}
            value={blocking}
            onValueChange={setBlocking}
            trackColor={{ true: colors.danger, false: colors.border }}
          />
        </View>
      ) : null}

      <FieldShell label={t('feedback.screenshot')}>
        {screenshot ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Image
              source={{ uri: attachmentUri(screenshot) }}
              accessibilityLabel={t('feedback.screenshotPreview')}
              style={{
                width: 72,
                height: 128,
                borderRadius: radius.sm,
                backgroundColor: colors.surface,
              }}
              contentFit="cover"
            />
            <TextButton
              label={t('feedback.removeScreenshot')}
              color="danger"
              onPress={() => replaceScreenshot(null)}
            />
          </View>
        ) : (
          <TextButton label={t('feedback.addScreenshot')} onPress={() => void addScreenshot()} />
        )}
      </FieldShell>

      <TextField
        label={t('feedback.contactLabel')}
        value={contactEmail}
        onChangeText={setContactEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        maxLength={200}
        hint={t('feedback.contactHint')}
        error={errors.contactEmail}
      />

      <View
        accessible
        style={{
          gap: spacing.xs,
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Feather name="info" size={16} color={colors.muted} />
          <AppText variant="caption" color="muted">
            {t('feedback.attachedTitle')}
          </AppText>
        </View>
        <AppText variant="caption">
          {t('feedback.attached', {
            version: context.appVersion,
            os: context.os,
            locale: context.locale,
          })}
        </AppText>
        {errorName ? (
          <AppText variant="caption">{t('feedback.attachedError', { name: errorName })}</AppText>
        ) : null}
        <AppText variant="caption" color="muted">
          {t('feedback.noPersonal')}
        </AppText>
        {!auth.userId ? (
          <AppText variant="caption" color="muted">
            {t('feedback.screenshotNeedsAccount')}
          </AppText>
        ) : null}
        {!server ? (
          <AppText variant="caption" color="muted">
            {t('feedback.mailNote')}
          </AppText>
        ) : null}
      </View>
    </FormScreen>
  );
}
