import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ScrollView, View } from 'react-native';

import { LEGAL } from '@/shared/legal';
import { useTheme } from '@/shared/theme';
import { AppText, Card } from '@/shared/ui';

/** Ordre des sections (mêmes clés que docs/PRIVACY_POLICY.md). */
const SECTIONS = [
  'who',
  'summary',
  'data',
  'permissions',
  'leaves',
  'visible',
  'retention',
  'security',
  'minors',
  'rights',
  'account',
  'feedback',
  'changes',
] as const;

/** Paragraphe ou liste à puces (lignes commençant par « • »). */
function Body({ text }: { text: string }) {
  const { spacing } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      {text.split('\n\n').map((para, i) => {
        const lines = para.split('\n');
        return (
          <View key={i} style={{ gap: 6 }}>
            {lines.map((line, j) =>
              line.startsWith('• ') ? (
                <View key={j} style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <AppText color="primary">•</AppText>
                  <AppText style={{ flex: 1 }}>{line.slice(2)}</AppText>
                </View>
              ) : (
                <AppText key={j}>{line}</AppText>
              ),
            )}
          </View>
        );
      })}
    </View>
  );
}

/** Politique de confidentialité (même texte que la page publique donnée aux stores). */
export default function PrivacyScreen() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const params = {
    publisher: LEGAL.publisher || t('privacy.toFill'),
    email: LEGAL.contactEmail || t('privacy.toFill'),
    region: LEGAL.serverRegion || t('privacy.toFill'),
    interpolation: { escapeValue: false },
  };

  return (
    <ScrollView
      contentContainerStyle={{
        padding: spacing.xl,
        gap: spacing.lg,
        paddingBottom: spacing.xxl * 2,
      }}
    >
      <Stack.Screen options={{ title: t('privacy.title') }} />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title">{t('privacy.title')}</AppText>
        <AppText variant="caption" color="muted">
          {t('privacy.updated')}
        </AppText>
      </View>
      <AppText>{t('privacy.intro')}</AppText>
      {SECTIONS.map((key) => (
        <Card key={key}>
          <View style={{ gap: spacing.sm }}>
            <AppText variant="heading">{t(`privacy.${key}.title`)}</AppText>
            <Body text={t(`privacy.${key}.body`, params)} />
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
