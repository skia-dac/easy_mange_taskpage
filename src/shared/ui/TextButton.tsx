import { minTouchSize, type ColorTokens } from '../theme';
import { AppText } from './AppText';
import { Tappable } from './Tappable';

type Props = {
  label: string;
  onPress: () => void;
  color?: keyof ColorTokens;
  disabled?: boolean;
  /** Pour un libellé purement visuel (« ‹ »), ce que le lecteur d'écran annonce. */
  accessibilityLabel?: string;
};

/** Bouton texte (actions secondaires, « Supprimer »…). */
export function TextButton({
  label,
  onPress,
  color = 'primary',
  disabled = false,
  accessibilityLabel,
}: Props) {
  return (
    <Tappable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={() => ({
        minHeight: minTouchSize,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.4 : 1,
      })}
    >
      <AppText variant="bodyStrong" color={color} style={{ textAlign: 'center' }}>
        {label}
      </AppText>
    </Tappable>
  );
}
