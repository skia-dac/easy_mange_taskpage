import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useNotesDesk } from '@/components/NotesDesk';
import { ProfileButton } from '@/components/ProfileButton';
import { Fab, Screen } from '@/shared/ui';

/** L'ancienne page Notes : le contenu vit maintenant dans l'onglet Carnet. */
export default function NotesScreen() {
  const { t } = useTranslation();
  const notes = useNotesDesk();

  return (
    <View style={{ flex: 1 }}>
      <Screen stagger title={t('notes.title')} actions={<ProfileButton />}>
        {notes.body}
        <View style={{ height: 80 }} />
      </Screen>
      <Fab accessibilityLabel={t('notes.new')} onPress={notes.add} />
    </View>
  );
}
