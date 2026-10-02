import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { NotesPane } from '@/components/notebook/NotesPane';
import { todoTabOf, TodoPane } from '@/components/notebook/TodoPane';
import {
  getNotebookView,
  isNotebookView,
  NOTEBOOK_VIEW_KEY,
  setNotebookView,
  type NotebookView,
} from '@/modules/identity';
import { settingTable, useDb, useLiveQuery } from '@/shared/db';
import { userMessageKey } from '@/shared/errors';
import { LoadingScreen, Segmented, showError } from '@/shared/ui';

/**
 * Onglet Carnet : « À faire » (tâches, devoirs, examens) et « Notes » dans le même onglet.
 * `view=todo|notes` dans le lien l'emporte sur la dernière vue retenue.
 */
export default function NotebookScreen() {
  const { t } = useTranslation();
  const db = useDb();
  const params = useLocalSearchParams<{ view?: string; tab?: string }>();
  const linked = isNotebookView(params.view) ? params.view : null;
  const stored = useLiveQuery(getNotebookView, [settingTable(NOTEBOOK_VIEW_KEY)], []);
  // Choix fait ici, valable tant que le lien ne demande pas une autre vue.
  const [picked, setPicked] = useState<{ linked: NotebookView | null; view: NotebookView } | null>(
    null,
  );
  const view = picked && picked.linked === linked ? picked.view : (linked ?? stored.data ?? null);

  if (!view) return <LoadingScreen />;

  const choose = (next: NotebookView) => {
    setPicked({ linked, view: next });
    router.setParams({ view: next });
    void setNotebookView(db, next).catch((e: unknown) => showError(userMessageKey(e)));
  };

  const switcher = (
    <Segmented
      value={view}
      onChange={choose}
      accessibilityLabel={t('notebook.views')}
      options={[
        { value: 'todo', label: t('notebook.todo') },
        { value: 'notes', label: t('notebook.notes') },
      ]}
    />
  );
  const title = t('tabs.notebook');

  return view === 'notes' ? (
    <NotesPane title={title} switcher={switcher} />
  ) : (
    <TodoPane title={title} switcher={switcher} initialTab={todoTabOf(params.tab)} />
  );
}
