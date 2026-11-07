import { View } from 'react-native';

import { useTheme, type ColorTokens, type SubjectColor } from '../theme';
import { AppText } from './AppText';
import { useLineLimit } from './useLargeText';

export type ChipTone = 'primary' | 'warning' | 'danger' | 'success' | 'muted';

const tones: Record<ChipTone, [keyof ColorTokens, keyof ColorTokens]> = {
  primary: ['primary', 'primarySoft'],
  warning: ['warning', 'warningSoft'],
  danger: ['danger', 'dangerSoft'],
  success: ['success', 'successSoft'],
  muted: ['muted', 'background'],
};

type Props = { label: string; tone?: ChipTone; subject?: SubjectColor };

/** Petite étiquette : état (« En retard »), compte à rebours ou matière (avec sa couleur). */
export function Chip({ label, tone = 'primary', subject }: Props) {
  const { colors, radius, spacing, scheme } = useTheme();
  const lines = useLineLimit(1);
  const [fg, bg] = subject
    ? scheme === 'dark'
      ? [subject.strongDark, subject.softDark]
      : [subject.strong, subject.soft]
    : [colors[tones[tone][0]], colors[tones[tone][1]]];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: bg,
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.xxs,
      }}
    >
      <AppText variant="caption" numberOfLines={lines} style={{ color: fg }}>
        {label}
      </AppText>
    </View>
  );
}
