import { Text, type TextProps } from 'react-native';

import { useTheme, type ColorTokens, type TextVariant } from '../theme';

type Props = TextProps & {
  variant?: TextVariant;
  /** Nom d'une couleur du thème (jamais une valeur en dur). */
  color?: keyof ColorTokens;
};

/** Texte de l'app : utilise toujours la typographie et les couleurs du thème. */
export function AppText({ variant = 'body', color = 'text', style, ...rest }: Props) {
  const theme = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={1.6}
      style={[theme.text[variant], { color: theme.colors[color] }, style]}
      {...rest}
    />
  );
}
