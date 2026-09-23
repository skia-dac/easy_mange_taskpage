import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { AppText } from './AppText';

type Props = { title: string; subtitle?: string; children?: ReactNode };

/** Squelette d'un écran principal : titre + contenu qui défile, sur le fond du thème. */
export function Screen({ title, subtitle, children }: Props) {
  const { colors, spacing } = useTheme();
  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
        <View style={{ gap: spacing.xs }}>
          {subtitle ? (
            <AppText variant="caption" color="muted">
              {subtitle}
            </AppText>
          ) : null}
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
        </View>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
