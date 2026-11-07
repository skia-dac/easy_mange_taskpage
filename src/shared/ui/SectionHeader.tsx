import { View } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';
import { Tappable } from './Tappable';

type Props = { title: string; action?: { label: string; onPress: () => void } };

export function SectionHeader({ title, action }: Props) {
  const { spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        // Grand texte : l'action passe sous le titre plutôt que de l'écraser.
        flexWrap: 'wrap',
        columnGap: spacing.md,
        marginTop: spacing.sm,
      }}
    >
      <AppText variant="heading" accessibilityRole="header" style={{ flexShrink: 1 }}>
        {title}
      </AppText>
      {action ? (
        <Tappable
          accessibilityRole="button"
          onPress={action.onPress}
          hitSlop={12}
          style={{ minHeight: minTouchSize, justifyContent: 'center' }}
        >
          <AppText variant="bodyStrong" color="primary">
            {action.label}
          </AppText>
        </Tappable>
      ) : null}
    </View>
  );
}
