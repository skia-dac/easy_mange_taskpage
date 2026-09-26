import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTabBarInset, useTabBarScrollHandlers } from '../tabBarVisibility';
import { useTheme } from '../theme';
import { AppText } from './AppText';
import { RiseIn, StaggerGroup } from './RiseIn';

type Props = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  /** Boutons à droite du titre (ex. recherche). */ actions?: ReactNode;
  /**
   * Le contenu n'entre plus d'un seul bloc : chaque `RiseIn` (carte, ligne) arrive
   * juste après le précédent.
   */
  stagger?: boolean;
};

/** Squelette d'un écran principal : titre + contenu qui défile, sur le fond du thème. */
export function Screen({ title, subtitle, children, actions, stagger }: Props) {
  const { colors, spacing } = useTheme();
  const scroll = useTabBarScrollHandlers();
  const tabBarInset = useTabBarInset();
  return (
    <SafeAreaView edges={['top']} style={[styles.fill, { backgroundColor: colors.background }]}>
      <ScrollView
        {...scroll}
        contentContainerStyle={{
          padding: spacing.xl,
          paddingBottom: spacing.xl + tabBarInset,
          gap: spacing.lg,
        }}
      >
        <RiseIn>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              {subtitle ? (
                <AppText variant="caption" color="muted">
                  {subtitle}
                </AppText>
              ) : null}
              <AppText variant="title" accessibilityRole="header">
                {title}
              </AppText>
            </View>
            {actions ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>{actions}</View>
            ) : null}
          </View>
        </RiseIn>
        {stagger ? (
          <StaggerGroup>
            <View style={{ gap: spacing.lg }}>{children}</View>
          </StaggerGroup>
        ) : (
          <RiseIn delay={50} style={{ gap: spacing.lg }}>
            {children}
          </RiseIn>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
