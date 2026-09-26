import Feather from '@expo/vector-icons/Feather';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';

import { fonts, minTouchSize, useTheme } from '../theme';

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
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        autoCorrect={false}
        style={{
          flex: 1,
          color: colors.text,
          fontFamily: fonts.body,
          fontSize: text.body.fontSize + 1,
          minHeight: minTouchSize,
        }}
        {...rest}
      />
      {value ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.clearSearch')}
          onPress={() => onChangeText('')}
          hitSlop={10}
        >
          <Feather name="x-circle" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
