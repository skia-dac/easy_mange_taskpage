/**
 * TOUTES les couleurs de MySky sont ici, et seulement ici.
 *
 * Pour changer une couleur : modifie sa valeur ci-dessous, tous les écrans suivent.
 * Une règle ESLint interdit d'écrire une couleur (#hex, rgb…) ailleurs dans src/.
 * Les tests vérifient que chaque couleur existe en clair ET en sombre, et que le
 * texte reste lisible (contraste suffisant).
 */

export type ColorTokens = {
  /** Couleur principale (boutons, onglet actif, carte « Prochain cours ») */
  primary: string;
  /** Version claire de la couleur principale (fonds de puces, onglet actif) */
  primarySoft: string;
  /** Texte posé sur la couleur principale */
  onPrimary: string;
  /** Fond des écrans */
  background: string;
  /** Fond des cartes */
  surface: string;
  /** Bordures et séparateurs */
  border: string;
  /** Texte principal */
  text: string;
  /** Texte secondaire */
  muted: string;
  /** « Aujourd'hui », « à vérifier » */
  warning: string;
  warningSoft: string;
  /** « En retard », suppression */
  danger: string;
  dangerSoft: string;
  /** « Terminé », « Enregistré » */
  success: string;
  successSoft: string;
  /** Voile derrière les fenêtres (bottom sheets, dialogues) */
  scrim: string;
};

export const lightColors: ColorTokens = {
  primary: '#1F5FD6',
  primarySoft: '#E6EEFC',
  onPrimary: '#FFFFFF',
  background: '#F4F7FC',
  surface: '#FFFFFF',
  border: '#DCE2EC',
  text: '#14213D',
  muted: '#5A6478',
  warning: '#B54708',
  warningSoft: '#FEF0E1',
  danger: '#C8291E',
  dangerSoft: '#FDE8E6',
  success: '#0E7555',
  successSoft: '#E2F3EC',
  scrim: 'rgba(20, 33, 61, 0.45)',
};

export const darkColors: ColorTokens = {
  primary: '#7AA2FF',
  primarySoft: '#1E2F55',
  onPrimary: '#0B1530',
  background: '#0F1628',
  surface: '#182238',
  border: '#2A3550',
  text: '#EAF0FA',
  muted: '#A3AEC2',
  warning: '#F5A25D',
  warningSoft: '#3A2A1C',
  danger: '#F2766B',
  dangerSoft: '#3D2124',
  success: '#4CC79A',
  successSoft: '#17362C',
  scrim: 'rgba(0, 0, 0, 0.6)',
};

/** Couleurs proposées pour les matières : couleur forte + version claire. */
export type SubjectColor = {
  id: string;
  strong: string;
  soft: string;
  strongDark: string;
  softDark: string;
};

export const subjectColors: readonly SubjectColor[] = [
  { id: 'violet', strong: '#6D4AE6', soft: '#EEE9FD', strongDark: '#B3A0FF', softDark: '#2B2352' },
  { id: 'teal', strong: '#0A7372', soft: '#DFF3F2', strongDark: '#5FD3D1', softDark: '#123837' },
  { id: 'green', strong: '#1F7A45', soft: '#E2F3E8', strongDark: '#6FD39A', softDark: '#173524' },
  { id: 'pink', strong: '#B42D66', soft: '#FBE6EF', strongDark: '#F28DB8', softDark: '#3C1E2C' },
  { id: 'amber', strong: '#9A5B00', soft: '#FCEFD9', strongDark: '#F2B955', softDark: '#3A2A12' },
  { id: 'blue', strong: '#2256C9', soft: '#E4ECFB', strongDark: '#8BB0FF', softDark: '#1C2A4D' },
  { id: 'red', strong: '#B3261E', soft: '#FCE7E5', strongDark: '#FF8F85', softDark: '#3D1F1D' },
  { id: 'slate', strong: '#475569', soft: '#EBEEF3', strongDark: '#B4BFCF', softDark: '#262E3A' },
];
