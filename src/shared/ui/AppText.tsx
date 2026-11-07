import { Text, type TextProps } from 'react-native';

import {
  useTheme,
  variantMaxFontSizeMultiplier,
  type ColorTokens,
  type TextVariant,
} from '../theme';

type Props = TextProps & {
  variant?: TextVariant;
  /** Nom d'une couleur du thème (jamais une valeur en dur). */
  color?: keyof ColorTokens;
};

/**
 * Texte de l'app : utilise toujours la typographie et les couleurs du thème. Il suit la taille
 * de texte du téléphone jusqu'à 200 % pour le contenu ; les grands titres plafonnent plus tôt.
 */
export function AppText({ variant = 'body', color = 'text', style, ...rest }: Props) {
  const theme = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={variantMaxFontSizeMultiplier[variant]}
      style={[theme.text[variant], { color: theme.colors[color] }, style]}
      {...rest}
    />
  );
}
