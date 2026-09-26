import { TextInput, type TextInputProps } from 'react-native';

import { fonts, maxFontSizeMultiplier, minTouchSize, useTheme } from '../theme';
import { FieldShell } from './FieldShell';

type Props = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
};

export function TextField({ label, required, error, hint, multiline, style, ...rest }: Props) {
  const { colors, radius, spacing, text } = useTheme();
  return (
    <FieldShell label={label} required={required} error={error} hint={hint}>
      <TextInput
        accessibilityLabel={label}
        maxFontSizeMultiplier={maxFontSizeMultiplier}
        placeholderTextColor={colors.muted}
        multiline={multiline}
        style={[
          {
            minHeight: multiline ? 96 : minTouchSize + 6,
            borderRadius: radius.md,
            borderWidth: 1.5,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md + 2,
            paddingTop: multiline ? spacing.md : 0,
            color: colors.text,
            fontFamily: fonts.body,
            fontSize: text.body.fontSize + 1,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
    </FieldShell>
  );
}
