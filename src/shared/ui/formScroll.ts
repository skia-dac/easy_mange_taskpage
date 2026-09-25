import { createContext } from 'react';
import type { View } from 'react-native';

/**
 * Fourni par `FormScreen` : un champ en erreur s'y signale pour que le formulaire défile
 * jusqu'au premier champ à corriger. `attempt` change à chaque envoi (pour re-signaler une
 * erreur restée identique).
 */
export type FormScroll = { attempt: number; reveal: (node: View) => void };
export const FormScrollContext = createContext<FormScroll | null>(null);
