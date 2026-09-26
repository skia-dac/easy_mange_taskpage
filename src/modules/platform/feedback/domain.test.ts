import { parseInput } from '@/shared/validation';

import {
  buildMailto,
  feedbackInputSchema,
  MESSAGE_MAX,
  normalizeFeedback,
  previewOf,
  safeErrorName,
  type Feedback,
} from './domain';

const valid = { kind: 'bug', message: 'Le bouton Terminer ne répond pas.' } as const;
const errorsOf = (input: unknown) => {
  try {
    parseInput(feedbackInputSchema, input);
    return {};
  } catch (e) {
    return (e as { fields: Record<string, string> }).fields;
  }
};

describe('retour : saisie', () => {
  it('accepte un retour minimal et range la partie dans « Autre » par défaut', () => {
    const v = parseInput(feedbackInputSchema, valid);
    expect(v).toMatchObject({ kind: 'bug', area: 'other', blocking: false, contactEmail: null });
  });

  it('exige le type', () => {
    expect(errorsOf({ message: valid.message }).kind).toBe('validation.required');
    expect(errorsOf({ ...valid, kind: 'spam' }).kind).toBe('validation.required');
  });

  it('refuse un message vide, trop court ou trop long', () => {
    expect(errorsOf({ ...valid, message: '   ' }).message).toBe('validation.required');
    expect(errorsOf({ ...valid, message: 'Trop bref' }).message).toBe(
      'validation.feedbackTooShort',
    );
    expect(errorsOf({ ...valid, message: 'x'.repeat(MESSAGE_MAX + 1) }).message).toBe(
      'validation.tooLong',
    );
    expect(errorsOf({ ...valid, message: 'x'.repeat(MESSAGE_MAX) }).message).toBeUndefined();
  });

  it('vérifie l’e-mail seulement s’il est rempli', () => {
    expect(errorsOf({ ...valid, contactEmail: 'pas-un-mail' }).contactEmail).toBe(
      'validation.invalidEmail',
    );
    expect(errorsOf({ ...valid, contactEmail: '  ' })).toEqual({});
    expect(
      parseInput(feedbackInputSchema, { ...valid, contactEmail: ' Awa@Mail.CM ' }),
    ).toMatchObject({ contactEmail: 'awa@mail.cm' });
  });

  it('« bloquant » n’a de sens que pour un bug', () => {
    const idea = parseInput(feedbackInputSchema, { ...valid, kind: 'idea', blocking: true });
    expect(normalizeFeedback(idea).blocking).toBe(false);
    const bug = parseInput(feedbackInputSchema, { ...valid, blocking: true });
    expect(normalizeFeedback(bug).blocking).toBe(true);
  });

  it('ne garde que le nom technique d’une erreur, jamais un message', () => {
    expect(safeErrorName('TypeError')).toBe('TypeError');
    expect(safeErrorName('Cannot read property of awa@mail.cm')).toBeNull();
    expect(safeErrorName(42)).toBeNull();
  });

  it('résume le message sur une ligne', () => {
    expect(previewOf('Bonjour\n  le monde')).toBe('Bonjour le monde');
    expect(previewOf('a'.repeat(80))).toBe(`${'a'.repeat(60)}…`);
  });
});

describe('retour : e-mail de repli', () => {
  it('encode le sujet et le corps', () => {
    const f = {
      id: 'f1',
      kind: 'idea',
      area: 'tasks',
      message: 'Trier par date & priorité ?',
      blocking: false,
      contactEmail: null,
      screenshotPath: null,
      errorName: null,
      appVersion: '1.0.0',
      os: 'Android 34',
      locale: 'fr',
      status: 'pending',
      sentAt: null,
      createdAt: '2026-09-26T10:00:00.000Z',
      errorCode: null,
    } satisfies Feedback;
    const url = buildMailto('contact@example.com', f, {
      subject: 'MySky – Une idée (Tâches)',
      kind: 'Type : Une idée',
      area: 'Partie : Tâches',
      blocking: null,
      contact: null,
      technical: 'MySky 1.0.0 · Android 34 · langue fr',
    });
    expect(url.startsWith('mailto:contact@example.com?subject=')).toBe(true);
    const body = decodeURIComponent(url.split('&body=')[1]!);
    expect(body).toContain('Trier par date & priorité ?');
    expect(body).toContain('Android 34');
    expect(url).not.toContain(' ');
  });
});
