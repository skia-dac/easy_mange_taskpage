import Feather from '@expo/vector-icons/Feather';
import { TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SEARCH_MAX } from '../fieldLimits';
import { minTouchSize, useTheme } from '../theme';
import { useInputProps } from './inputProps';
import { Tappable } from './Tappable';

type Props = Omit<TextInputProps, 'value' | 'onChangeText'> & {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  /** Bordure accentuée (écran de recherche). */
  emphasized?: boolean;
};

/** Champ de recherche avec sa croix d'effacement, identique sur iPhone et Android. */
export function SearchInput({ value, onChangeText, placeholder, emphasized, ...rest }: Props) {
  const { t } = useTranslation();
  const { colors, radius, spacing, text } = useTheme();
  const inputProps = useInputProps();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: minTouchSize + 6,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        borderWidth: emphasized ? 1.5 : 1,
        borderColor: emphasized ? colors.primary : colors.border,
        paddingHorizontal: spacing.md,
      }}
    >
      <Feather name="search" size={18} color={colors.muted} />
      <TextInput
        accessibilityLabel={placeholder}
        {...inputProps}
        value={value}
        onChangeText={(next) => onChangeText(next.slice(0, SEARCH_MAX))}
        maxLength={SEARCH_MAX}
        placeholder={placeholder}
        returnKeyType="search"
        autoCorrect={false}
        style={{
          flex: 1,
          color: colors.text,
          fontFamily: text.input.fontFamily,
          fontSize: text.input.fontSize,
          minHeight: minTouchSize,
        }}
        {...rest}
      />
      {value ? (
        <Tappable
          accessibilityRole="button"
          accessibilityLabel={t('common.clearSearch')}
          onPress={() => onChangeText('')}
          hitSlop={10}
          style={{
            minHeight: minTouchSize,
            minWidth: minTouchSize,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: -spacing.sm,
          }}
        >
          <Feather name="x-circle" size={18} color={colors.muted} />
        </Tappable>
      ) : null}
    </View>
  );
}
