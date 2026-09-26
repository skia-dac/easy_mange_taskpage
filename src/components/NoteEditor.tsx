import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Pressable,
  ScrollView,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';

import { NOTE_CONTENT_MAX } from '@/shared/fieldLimits';
import {
  continueListOnEnter,
  toggleLinePrefix,
  wrapSelection,
  type Selection,
} from '@/modules/productivity';
import { fonts, minTouchSize, useTheme } from '@/shared/theme';

type Tool = { icon: ComponentProps<typeof Feather>['name']; label: string; onPress: () => void };

function ToolButton({ icon, label, onPress }: Tool) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: minTouchSize,
        height: minTouchSize,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.primarySoft : 'transparent',
      })}
    >
      <Feather name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoFocus?: boolean;
  /** Boutons supplémentaires à droite de la barre (pièces jointes). */
  extraActions?: Tool[];
};

/** Éditeur de note : zone de texte + barre d'outils de mise en forme légère (§46). */
export function NoteEditor({ value, onChange, placeholder, autoFocus, extraActions = [] }: Props) {
  const { t } = useTranslation();
  const { colors, spacing, text } = useTheme();
  const input = useRef<TextInput>(null);
  const [selection, setSelection] = useState<Selection>({ start: value.length, end: value.length });
  const pending = useRef<Selection | null>(null);

  const apply = (edit: { content: string; selection: Selection }) => {
    onChange(edit.content);
    pending.current = edit.selection;
    setSelection(edit.selection);
    input.current?.focus();
  };

  const onSelectionChange = (e: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    const s = e.nativeEvent.selection;
    if (pending.current && (s.start !== pending.current.start || s.end !== pending.current.end))
      return;
    pending.current = null;
    setSelection({ start: s.start, end: s.end });
  };

  const onChangeText = (text: string) => {
    // Entrée après une ligne de liste : on continue la liste (ou on la termine si elle est vide).
    const typedNewline =
      text.length === value.length + 1 &&
      text.slice(0, selection.start) === value.slice(0, selection.start) &&
      text[selection.start] === '\n';
    if (typedNewline) {
      const edit = continueListOnEnter(value, selection);
      if (edit) {
        apply(edit);
        return;
      }
    }
    onChange(text);
    pending.current = null;
  };

  return (
    <View style={{ flex: 1 }}>
      <TextInput
        ref={input}
        accessibilityLabel={placeholder}
        multiline
        autoFocus={autoFocus}
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={onSelectionChange}
        maxLength={NOTE_CONTENT_MAX}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        scrollEnabled
        textAlignVertical="top"
        style={{
          flex: 1,
          minHeight: 240,
          padding: spacing.lg,
          color: colors.text,
          fontFamily: fonts.body,
          fontSize: text.body.fontSize + 1,
          lineHeight: text.body.lineHeight + 2,
        }}
      />
      <View
        accessibilityRole="toolbar"
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
        }}
      >
        <ScrollView
          horizontal
          keyboardShouldPersistTaps="always"
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing.sm, gap: 2 }}
        >
          <ToolButton
            icon="type"
            label={t('editor.heading')}
            onPress={() => apply(toggleLinePrefix(value, selection, 'heading'))}
          />
          <ToolButton
            icon="bold"
            label={t('editor.bold')}
            onPress={() => apply(wrapSelection(value, selection, '**'))}
          />
          <ToolButton
            icon="italic"
            label={t('editor.italic')}
            onPress={() => apply(wrapSelection(value, selection, '_'))}
          />
          <ToolButton
            icon="list"
            label={t('editor.bullet')}
            onPress={() => apply(toggleLinePrefix(value, selection, 'bullet'))}
          />
          <ToolButton
            icon="hash"
            label={t('editor.numbered')}
            onPress={() => apply(toggleLinePrefix(value, selection, 'numbered'))}
          />
          <ToolButton
            icon="check-square"
            label={t('editor.check')}
            onPress={() => apply(toggleLinePrefix(value, selection, 'check'))}
          />
          {extraActions.length > 0 ? (
            <View
              style={{
                width: 1,
                height: 26,
                backgroundColor: colors.border,
                marginHorizontal: spacing.xs,
                alignSelf: 'center',
              }}
            />
          ) : null}
          {extraActions.map((tool) => (
            <ToolButton
              key={tool.label}
              icon={tool.icon}
              label={tool.label}
              onPress={tool.onPress}
            />
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
