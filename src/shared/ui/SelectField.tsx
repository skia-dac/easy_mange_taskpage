import Feather from '@expo/vector-icons/Feather';
import { useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { minTouchSize, useTheme } from '../theme';
import { AppText } from './AppText';
import { FieldShell } from './FieldShell';

export type SelectOption = { value: string; label: string; leading?: ReactNode };

type Props = {
  label: string;
  value: string | null;
  options: readonly SelectOption[];
  onChange: (value: string | null) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
  /** Ajoute un choix « Aucune » (champ facultatif). */
  noneLabel?: string;
  /** Action en bas de la liste, ex. « Créer une matière ». */
  footer?: { label: string; onPress: () => void };
};

/** Liste de choix dans une fenêtre (matière, emploi du temps…). */
export function SelectField({
  label,
  value,
  options,
  onChange,
  placeholder,
  required,
  error,
  noneLabel,
  footer,
}: Props) {
  const { t } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);
  const choose = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };
  const all: (SelectOption | { value: null; label: string; leading?: ReactNode })[] = noneLabel
    ? [{ value: null, label: noneLabel }, ...options]
    : [...options];

  return (
    <FieldShell label={label} required={required} error={error}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${current?.label ?? placeholder ?? ''}`}
        onPress={() => setOpen(true)}
        style={{
          minHeight: minTouchSize + 6,
          borderRadius: radius.md,
          borderWidth: 1.5,
          borderColor: error ? colors.danger : colors.border,
          backgroundColor: colors.surface,
          paddingHorizontal: spacing.md + 2,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        {current?.leading}
        <AppText color={current ? 'text' : 'muted'} style={{ flex: 1 }} numberOfLines={1}>
          {current?.label ??
            (value === null && noneLabel ? noneLabel : (placeholder ?? t('common.choose')))}
        </AppText>
        <Feather name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.lg }}>
            <AppText variant="heading" style={{ flex: 1 }}>
              {label}
            </AppText>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={12}>
              <AppText variant="bodyStrong" color="primary">
                {t('common.close')}
              </AppText>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              gap: spacing.sm,
              paddingBottom: spacing.xxl,
            }}
          >
            {all.map((o) => {
              const selected = o.value === value;
              return (
                <Pressable
                  key={o.value ?? '__none'}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => choose(o.value)}
                  style={{
                    minHeight: minTouchSize + 8,
                    borderRadius: radius.md,
                    backgroundColor: selected ? colors.primarySoft : colors.surface,
                    paddingHorizontal: spacing.lg,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                  }}
                >
                  {o.leading}
                  <AppText variant="bodyStrong" style={{ flex: 1 }}>
                    {o.label}
                  </AppText>
                  {selected ? <Feather name="check" size={20} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
            {footer ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setOpen(false);
                  footer.onPress();
                }}
                style={{
                  minHeight: minTouchSize + 8,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingHorizontal: spacing.lg,
                }}
              >
                <Feather name="plus" size={20} color={colors.primary} />
                <AppText variant="bodyStrong" color="primary">
                  {footer.label}
                </AppText>
              </Pressable>
            ) : null}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </FieldShell>
  );
}
