import { channelFor } from './scheduler';

describe('canal Android selon son / vibration', () => {
  it('choisit un canal différent pour chaque combinaison', () => {
    const all = new Set([
      channelFor({ sound: true, vibrate: true }),
      channelFor({ sound: true, vibrate: false }),
      channelFor({ sound: false, vibrate: true }),
      channelFor({ sound: false, vibrate: false }),
    ]);
    expect(all.size).toBe(4);
    expect(channelFor({ sound: true, vibrate: true })).toBe('reminders');
  });
});
