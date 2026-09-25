import Feather from '@expo/vector-icons/Feather';
import { Pressable, View } from 'react-native';

import { parseBlocks, type Inline } from '@/modules/productivity';
import { minTouchSize, useTheme } from '@/shared/theme';
import { AppText } from '@/shared/ui';

type Props = {
  content: string;
  /** Si fourni, les cases à cocher sont cliquables (numéro de ligne). */
  onToggleCheck?: (line: number) => void;
};

function Inlines({
  inlines,
  variant = 'body' as const,
}: {
  inlines: Inline[];
  variant?: 'body' | 'heading' | 'title';
}) {
  return (
    <AppText variant={variant}>
      {inlines.map((i, k) => (
        <AppText
          key={k}
          variant={variant}
          style={{
            fontWeight: i.bold ? '700' : undefined,
            fontStyle: i.italic ? 'italic' : undefined,
          }}
        >
          {i.text}
        </AppText>
      ))}
    </AppText>
  );
}

/** Affiche une note avec sa mise en forme légère (lecture). */
export function NoteContent({ content, onToggleCheck }: Props) {
  const { colors, spacing } = useTheme();
  const blocks = parseBlocks(content);
  return (
    <View style={{ gap: spacing.xs }}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'blank':
            return <View key={i} style={{ height: spacing.sm }} />;
          case 'heading':
            return (
              <View key={i} style={{ marginTop: i === 0 ? 0 : spacing.sm }}>
                <Inlines inlines={b.inlines} variant={b.level === 1 ? 'title' : 'heading'} />
              </View>
            );
          case 'bullet':
          case 'numbered':
            return (
              <View
                key={i}
                style={{ flexDirection: 'row', gap: spacing.sm, paddingLeft: spacing.xs }}
              >
                <AppText style={{ width: b.type === 'numbered' ? 24 : 12 }}>
                  {b.type === 'numbered' ? `${b.number}.` : '•'}
                </AppText>
                <View style={{ flex: 1 }}>
                  <Inlines inlines={b.inlines} />
                </View>
              </View>
            );
          case 'check':
            return (
              <Pressable
                key={i}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: b.checked }}
                disabled={!onToggleCheck}
                onPress={() => onToggleCheck?.(b.line)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: spacing.sm,
                  minHeight: minTouchSize - 12,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 7,
                    marginTop: 1,
                    borderWidth: 2,
                    borderColor: b.checked ? colors.success : colors.muted,
                    backgroundColor: b.checked ? colors.success : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {b.checked ? <Feather name="check" size={14} color={colors.surface} /> : null}
                </View>
                <View style={{ flex: 1 }}>
                  <AppText
                    color={b.checked ? 'muted' : 'text'}
                    style={b.checked ? { textDecorationLine: 'line-through' } : undefined}
                  >
                    {b.inlines.map((x) => x.text).join('')}
                  </AppText>
                </View>
              </Pressable>
            );
          default:
            return (
              <View key={i}>
                <Inlines inlines={b.inlines} />
              </View>
            );
        }
      })}
    </View>
  );
}
