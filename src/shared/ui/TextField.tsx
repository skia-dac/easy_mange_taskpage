import { useEffect, useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { checkInput, limitInput, maxLengthOf, type InputLimit } from '../fieldLimits';
import { fonts, maxFontSizeMultiplier, minTouchSize, useTheme } from '../theme';
import { FieldShell } from './FieldShell';

type Props = Omit<TextInputProps, 'value' | 'onChangeText' | 'maxLength'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  /** Longueur et forme autorisées pour ce champ. */
  limit: InputLimit;
  required?: boolean;
  error?: string;
  hint?: string;
};

function keyboardFor(limit: InputLimit): Partial<TextInputProps> {
  switch (limit.kind) {
    case 'email':
      return {
        keyboardType: 'email-address',
        autoCapitalize: 'none',
        autoCorrect: false,
        inputMode: 'email',
      };
    case 'integer':
      return { keyboardType: 'number-pad', autoCorrect: false };
    case 'decimal':
    case 'money':
      return { keyboardType: 'decimal-pad', autoCorrect: false };
    case 'code':
      return { autoCapitalize: 'characters', autoCorrect: false };
    case 'academicYear':
      return {
        autoCapitalize: 'none',
        autoCorrect: false,
        keyboardType: 'numbers-and-punctuation',
      };
    default:
      return {};
  }
}

export function TextField({
  label,
  required,
  error,
  hint,
  multiline,
  style,
  limit,
  value,
  onChangeText,
  onBlur,
  ...rest
}: Props) {
  const { colors, radius, spacing, text } = useTheme();
  const [touched, setTouched] = useState(false);
  const shown = limitInput(value, limit);
  const localError = touched ? checkInput(shown, limit) : null;

  useEffect(() => {
    if (shown !== value) onChangeText(shown);
  }, [onChangeText, shown, value]);

  return (
    <FieldShell
      label={label}
      required={required}
      error={error ?? localError ?? undefined}
      hint={hint}
    >
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
            borderColor: error || localError ? colors.danger : colors.border,
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
        {...keyboardFor(limit)}
        value={shown}
        maxLength={maxLengthOf(limit)}
        onChangeText={(next) => onChangeText(limitInput(next, limit))}
        onBlur={(event) => {
          setTouched(true);
          onBlur?.(event);
        }}
      />
    </FieldShell>
  );
}
