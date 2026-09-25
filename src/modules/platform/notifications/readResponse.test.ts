import type * as Notifications from 'expo-notifications';

import { readResponse } from './scheduler';

const response = (data: unknown) =>
  ({
    actionIdentifier: 'default',
    notification: { request: { content: { data } } },
  }) as unknown as Notifications.NotificationResponse;

describe('readResponse', () => {
  it('accepte une action connue', () => {
    expect(readResponse(response({ kind: 'exam', id: 'e1' }))).toEqual({
      actionIdentifier: 'default',
      action: { kind: 'exam', id: 'e1' },
    });
  });

  it('ignore une action inconnue, incomplète ou absente', () => {
    expect(readResponse(response({ kind: 'teleport', id: 'x' }))).toBeNull();
    expect(readResponse(response({ kind: 'work', id: 'w' }))).toBeNull();
    expect(readResponse(response(undefined))).toBeNull();
    expect(readResponse(null)).toBeNull();
  });
});
