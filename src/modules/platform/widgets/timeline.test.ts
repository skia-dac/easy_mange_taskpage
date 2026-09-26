import { pickTimelineEntry } from './timeline';

const entries = [
  { date: '2026-09-23T08:30:00.000Z', props: 'now' },
  { date: '2026-09-23T09:00:01.000Z', props: 'start' },
  { date: '2026-09-23T11:00:01.000Z', props: 'end' },
  { date: '2026-09-24T00:00:01.000Z', props: 'midnight' },
];

describe('pickTimelineEntry', () => {
  it('choisit la dernière entrée dont la date est passée', () => {
    expect(pickTimelineEntry(entries, new Date('2026-09-23T08:30:00.000Z'))?.props).toBe('now');
    expect(pickTimelineEntry(entries, new Date('2026-09-23T10:15:00.000Z'))?.props).toBe('start');
    expect(pickTimelineEntry(entries, new Date('2026-09-23T11:00:01.000Z'))?.props).toBe('end');
    expect(pickTimelineEntry(entries, new Date('2026-09-25T07:00:00.000Z'))?.props).toBe(
      'midnight',
    );
  });

  it('ne dépend pas de l’ordre des entrées', () => {
    const shuffled = [entries[2]!, entries[0]!, entries[3]!, entries[1]!];
    expect(pickTimelineEntry(shuffled, new Date('2026-09-23T12:00:00.000Z'))?.props).toBe('end');
  });

  it('prend la première entrée si toutes sont dans le futur, et null sans entrée', () => {
    expect(pickTimelineEntry(entries, new Date('2026-09-20T00:00:00.000Z'))?.props).toBe('now');
    expect(pickTimelineEntry([], new Date())).toBeNull();
  });

  it('ignore une date illisible', () => {
    const broken = [{ date: 'pas-une-date', props: 'x' }, entries[0]!];
    expect(pickTimelineEntry(broken, new Date('2026-09-23T09:00:00.000Z'))?.props).toBe('now');
  });
});
