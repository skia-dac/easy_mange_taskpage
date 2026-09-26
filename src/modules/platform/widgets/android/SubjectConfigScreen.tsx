import type { WidgetConfigurationScreenProps } from 'react-native-android-widget';
import { useState } from 'react';
import { Appearance, Pressable, ScrollView, Text, View } from 'react-native';

import { pickWidgetTheme, type WidgetTheme } from '@/projections';
import { darkColors, lightColors, radius, spacing } from '@/shared/theme';

import { readCurrentWidgetData, readWidgetConfig, writeWidgetConfig } from '../snapshot';
import { renderAndroidWidget } from './widgets';

/** Sans chronologie écrite (app jamais ouverte), on retombe sur le thème du kit. */
function fallbackTheme(dark: boolean): WidgetTheme {
  return pickWidgetTheme(dark ? darkColors : lightColors);
}

/**
 * Écran de configuration du widget Android « Matière » (appui long → Configurer).
 * Il tourne hors de l'app (pas de base, pas de thème, pas de traductions chargées) :
 * il lit la chronologie écrite par l'app, qui contient déjà les matières, les textes traduits
 * et les couleurs claires / sombres.
 */
export function SubjectConfigScreen({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const data = readCurrentWidgetData();
  const current = readWidgetConfig()[String(widgetInfo.widgetId)]?.subjectId ?? null;
  const [selected, setSelected] = useState<string | null>(current);
  const dark = Appearance.getColorScheme() === 'dark';
  const colors = data ? (dark ? data.dark : data.light) : fallbackTheme(dark);

  const confirm = () => {
    if (!data) {
      setResult('cancel');
      return;
    }
    writeWidgetConfig(widgetInfo.widgetId, selected);
    renderWidget(renderAndroidWidget('Subject', data, { subjectId: selected }));
    setResult('ok');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: spacing.xl, gap: spacing.md }}>
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>
        {data?.labels.subjectPick ?? data?.labels.appName ?? ''}
      </Text>
      <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
        {(data?.subjects ?? []).map((s) => (
          <Pressable
            key={s.id}
            accessibilityRole="button"
            accessibilityState={{ selected: selected === s.id }}
            onPress={() => setSelected(s.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.lg,
              borderRadius: radius.lg,
              backgroundColor: colors.surface,
              borderWidth: 2,
              borderColor: selected === s.id ? colors.primary : colors.border,
            }}
          >
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: s.color }} />
            <Text style={{ fontSize: 16, color: colors.text, flex: 1 }}>{s.name}</Text>
          </Pressable>
        ))}
        {!data || data.subjects.length === 0 ? (
          <Text style={{ color: colors.muted }}>{data?.labels.subjectNone ?? ''}</Text>
        ) : null}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        onPress={confirm}
        style={{ backgroundColor: colors.primary, borderRadius: radius.md, padding: spacing.lg, alignItems: 'center' }}
      >
        <Text style={{ color: colors.onPrimary, fontWeight: '600', fontSize: 16 }}>
          {data?.labels.ok ?? ''}
        </Text>
      </Pressable>
    </View>
  );
}
