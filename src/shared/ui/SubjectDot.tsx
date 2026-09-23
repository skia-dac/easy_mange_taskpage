import { View } from 'react-native';

import { useTheme, type SubjectColor } from '../theme';

/** Pastille de la couleur d'une matière. */
export function SubjectDot({ color, size = 12 }: { color: SubjectColor; size?: number }) {
  const { scheme } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: scheme === 'dark' ? color.strongDark : color.strong,
      }}
    />
  );
}

/** Barre verticale de la couleur d'une matière (lignes de cours). */
export function SubjectBar({ color }: { color: SubjectColor }) {
  const { scheme } = useTheme();
  return (
    <View
      style={{
        width: 4,
        alignSelf: 'stretch',
        borderRadius: 2,
        backgroundColor: scheme === 'dark' ? color.strongDark : color.strong,
      }}
    />
  );
}
