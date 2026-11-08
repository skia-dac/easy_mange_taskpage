import { createTestDb } from '@/test/memoryDb';

import { createWorkItem } from './commands';
import { findWorkItem, getWorkItemOfKind } from './queries';

describe('retrouver une tâche ou un devoir par son id', () => {
  it('cherche dans les deux tables quand le type n’est pas donné', async () => {
    const db = await createTestDb();
    const base = { dueDate: '2026-10-10', priority: 'normal', status: 'todo' } as const;
    const task = await createWorkItem(db, 'task', { ...base, title: 'Courses' });
    const assignment = await createWorkItem(db, 'assignment', { ...base, title: 'TP' });
    expect((await findWorkItem(db, task))?.kind).toBe('task');
    expect((await findWorkItem(db, assignment))?.kind).toBe('assignment');
    expect(await findWorkItem(db, 'inconnu')).toBeNull();
    // Type donné : lecture directe dans cette table seulement.
    expect(await getWorkItemOfKind(db, 'task', assignment)).toBeNull();
    expect((await getWorkItemOfKind(db, undefined, assignment))?.title).toBe('TP');
    db.close();
  });
});
