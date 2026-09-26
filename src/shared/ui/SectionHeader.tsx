import { Pressable, View } from 'react-native';

import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';

type Props = { title: string; action?: { label: string; onPress: () => void } };

export function SectionHeader({ title, action }: Props) {
  const { spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: spacing.sm,
      }}
    >
      <AppText variant="heading" accessibilityRole="header">
        {title}
      </AppText>
      {action ? (
        <Pressable
          accessibilityRole="button"
          onPress={action.onPress}
          hitSlop={12}
          style={{ minHeight: minTouchSize, justifyContent: 'center' }}
        >
          <AppText variant="bodyStrong" color="primary">
            {action.label}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
