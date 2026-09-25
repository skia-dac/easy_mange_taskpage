import { write, type Db } from '@/shared/db';
import { AppError } from '@/shared/errors';
import { normalizeSpaceValue } from '@/shared/spaces';
import { parseInput } from '@/shared/validation';

import { slotInputSchema, type Slot, type SlotInput, type SlotRotation } from '../domain/slot';

type SlotRow = {
  id: string;
  title: string;
  weekdays: string;
  start_time: string;
  end_time: string;
  location: string | null;
  note: string | null;
  rotation: string;
  valid_from: string;
  valid_until: string | null;
  color_id: string;
  space: string;
};

function parseDays(v: string): number[] {
  try {
    const d = JSON.parse(v) as unknown;
    return Array.isArray(d) ? d.filter((n): n is number => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

const toSlot = (r: SlotRow): Slot => ({
  id: r.id,
  title: r.title,
  weekdays: parseDays(r.weekdays),
  startTime: r.start_time,
  endTime: r.end_time,
  location: r.location,
  note: r.note,
  rotation: (['every', 'A', 'B'].includes(r.rotation) ? r.rotation : 'every') as SlotRotation,
  validFrom: r.valid_from,
  validUntil: r.valid_until,
  colorId: r.color_id,
  space: normalizeSpaceValue(r.space),
});

function slotValues(input: SlotInput) {
  const v = parseInput(slotInputSchema, input);
  return {
    title: v.title,
    weekdays: JSON.stringify(v.weekdays),
    start_time: v.startTime,
    end_time: v.endTime,
    location: v.location,
    note: v.note,
    rotation: v.rotation,
    valid_from: v.validFrom,
    valid_until: v.validUntil,
    color_id: v.colorId,
    space: v.space,
  };
}

export async function listSlots(db: Db): Promise<Slot[]> {
  const rows = await db.getAllAsync<SlotRow>(
    'SELECT * FROM work_slots WHERE deleted_at IS NULL ORDER BY start_time, title',
    [],
  );
  return rows.map(toSlot);
}

export async function getSlot(db: Db, id: string): Promise<Slot | null> {
  const row = await db.getFirstAsync<SlotRow>(
    'SELECT * FROM work_slots WHERE id = ? AND deleted_at IS NULL',
    [id],
  );
  return row ? toSlot(row) : null;
}

export async function createSlot(db: Db, input: SlotInput) {
  const values = slotValues(input);
  return write(db, (w) => w.insert('work_slots', values));
}

export async function updateSlot(db: Db, id: string, input: SlotInput) {
  const values = slotValues(input);
  return write(db, (w) => w.update('work_slots', id, values));
}

export async function deleteSlot(db: Db, id: string) {
  return write(db, async (w) => {
    const row = await w.db.getFirstAsync<{ id: string }>(
      'SELECT id FROM work_slots WHERE id = ? AND deleted_at IS NULL',
      [id],
    );
    if (!row) throw new AppError('notFound');
    await w.softDelete('work_slots', id);
  });
}
