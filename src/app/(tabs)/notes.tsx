import { Redirect } from 'expo-router';

/** Ancienne adresse de l'onglet Notes : les notes sont maintenant dans le Carnet. */
export default function NotesRedirect() {
  return <Redirect href="/(tabs)/tasks?view=notes" />;
}
