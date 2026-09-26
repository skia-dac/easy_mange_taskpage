/**
 * Limites de saisie, partagées par les champs et les schémas.
 * `limitInput` coupe pendant la frappe. `checkInput` vérifie au moment où l'on quitte le champ
 * (un champ vide reste valide ici : l'obligation est vérifiée à l'enregistrement).
 */

export const EMAIL_MAX = 254;
export const PASSWORD_MAX = 72;
export const SEARCH_MAX = 80;
/** Plus petite unité : 1 000 milliards (12 chiffres en FCFA, 10 chiffres + centimes en euro). */
export const MONEY_MAX_MINOR = 1_000_000_000_000;

export type InputLimit =
  | { kind: 'text'; max: number }
  | { kind: 'email' }
  | { kind: 'password'; rules: boolean }
  | { kind: 'code'; max: number }
  | { kind: 'academicYear' }
  | { kind: 'integer'; min: number; max: number; error: string }
  | { kind: 'decimal'; min: number; max: number; decimals: number; error: string }
  | { kind: 'money'; decimals: number };

export const fieldLimits = {
  title120: { kind: 'text', max: 120 },
  title80: { kind: 'text', max: 80 },
  name60: { kind: 'text', max: 60 },
  name80: { kind: 'text', max: 80 },
  name40: { kind: 'text', max: 40 },
  person: { kind: 'text', max: 60 },
  teacher: { kind: 'text', max: 80 },
  room: { kind: 'text', max: 40 },
  location: { kind: 'text', max: 80 },
  code: { kind: 'code', max: 20 },
  semester: { kind: 'text', max: 20 },
  firstName: { kind: 'text', max: 60 },
  lastName: { kind: 'text', max: 60 },
  university: { kind: 'text', max: 120 },
  studyField: { kind: 'text', max: 120 },
  level: { kind: 'text', max: 60 },
  academicYear: { kind: 'academicYear' },
  description500: { kind: 'text', max: 500 },
  description1000: { kind: 'text', max: 1000 },
  description2000: { kind: 'text', max: 2000 },
  note120: { kind: 'text', max: 120 },
  note200: { kind: 'text', max: 200 },
  note300: { kind: 'text', max: 300 },
  note500: { kind: 'text', max: 500 },
  unit: { kind: 'text', max: 20 },
  category: { kind: 'text', max: 30 },
  email: { kind: 'email' },
  newPassword: { kind: 'password', rules: true },
  password: { kind: 'password', rules: false },
  duration: { kind: 'integer', min: 1, max: 24 * 60, error: 'validation.invalidDuration' },
  habitTarget: { kind: 'integer', min: 1, max: 50, error: 'validation.invalidCount' },
  grade: { kind: 'decimal', min: 0, max: 10_000, decimals: 2, error: 'validation.invalidGrade' },
  gradeMax: {
    kind: 'decimal',
    min: 0.01,
    max: 10_000,
    decimals: 2,
    error: 'validation.invalidGrade',
  },
  coefficient: {
    kind: 'decimal',
    min: 0.01,
    max: 100,
    decimals: 2,
    error: 'validation.invalidCoefficient',
  },
  weight: { kind: 'decimal', min: 20, max: 400, decimals: 1, error: 'validation.invalidWeight' },
} as const satisfies Record<string, InputLimit>;

export function moneyLimit(decimals: number): InputLimit {
  return { kind: 'money', decimals };
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Année scolaire « 2026-2027 » ou « 2026–2027 » : la seconde année suit la première. */
export function isAcademicYear(value: string): boolean {
  const match = value.trim().match(/^(\d{4})\s*[–-]\s*(\d{4})$/);
  if (!match) return false;
  const start = Number(match[1]);
  const end = Number(match[2]);
  return end > start && end - start <= 5 && start >= 1900 && end <= 2200;
}

export function maxLengthOf(limit: InputLimit): number {
  switch (limit.kind) {
    case 'text':
    case 'code':
      return limit.max;
    case 'email':
      return EMAIL_MAX;
    case 'password':
      return PASSWORD_MAX;
    case 'academicYear':
      return 20;
    case 'integer':
      return String(limit.max).length;
    case 'decimal':
      return String(Math.floor(limit.max)).length + (limit.decimals > 0 ? 1 + limit.decimals : 0);
    case 'money':
      return 12 - limit.decimals + (limit.decimals > 0 ? 1 + limit.decimals : 0);
  }
}

function trimNumber(intPart: string, maxDigits: number): string {
  const stripped = intPart.replace(/^0+(?=\d)/, '');
  return stripped.slice(0, maxDigits);
}

function withinMax(value: string, max: number): string {
  let out = value;
  while (out && !out.endsWith('.') && Number(out) > max) {
    if (out.includes('.')) {
      const [head, tail = ''] = out.split('.');
      out = tail.length > 0 ? `${head}.${tail.slice(0, -1)}` : (head ?? '');
    } else {
      out = out.slice(0, -1);
    }
  }
  return out;
}

/** Garde uniquement ce que ce type de champ peut contenir, et jamais plus que son maximum. */
export function limitInput(value: string, limit: InputLimit): string {
  switch (limit.kind) {
    case 'text':
      return value.slice(0, limit.max);
    case 'email':
      return value.replace(/\s/g, '').slice(0, EMAIL_MAX);
    case 'password':
      return value.slice(0, PASSWORD_MAX);
    case 'code':
      return value
        .replace(/[^A-Za-z0-9 -]/g, '')
        .toUpperCase()
        .slice(0, limit.max);
    case 'academicYear':
      return value.replace(/[^\d\s–-]/g, '').slice(0, 20);
    case 'integer': {
      const digits = value.replace(/\D/g, '');
      return withinMax(trimNumber(digits, String(limit.max).length), limit.max);
    }
    case 'decimal':
    case 'money': {
      const decimals = limit.decimals;
      const maxDigits =
        limit.kind === 'decimal' ? String(Math.floor(limit.max)).length : 12 - decimals;
      let raw = value.replace(/[^\d.,]/g, '').replace(/\./g, ',');
      const comma = raw.indexOf(',');
      if (comma !== -1) raw = raw.slice(0, comma + 1) + raw.slice(comma + 1).replace(/,/g, '');
      if (decimals === 0) raw = raw.replace(/,/g, '');
      const hasComma = raw.includes(',');
      const [head = '', tail = ''] = raw.split(',');
      const intPart = trimNumber(head, maxDigits);
      const frac = tail.slice(0, decimals);
      const joined = hasComma && decimals > 0 ? `${intPart || '0'},${frac}` : intPart;
      if (limit.kind === 'money') return joined;
      return withinMax(joined.replace(',', '.'), limit.max).replace('.', ',');
    }
  }
}

/** Clé de traduction si la valeur saisie n'a pas la forme attendue, sinon null. */
export function checkInput(value: string, limit: InputLimit): string | null {
  const text = value.trim();
  if (text === '' || text === '.') return null;
  switch (limit.kind) {
    case 'text':
    case 'code':
    case 'password': {
      if (limit.kind !== 'password' || !limit.rules || text === '') return null;
      if (value.length < 8) return 'auth.error.passwordShort';
      if (!/[A-Za-zÀ-ÿ]/.test(value) || !/\d/.test(value)) return 'auth.error.passwordWeak';
      return null;
    }
    case 'email':
      return EMAIL.test(text) ? null : 'auth.error.emailInvalid';
    case 'academicYear':
      return isAcademicYear(text) ? null : 'validation.invalidYear';
    case 'integer': {
      const n = Number(text);
      return Number.isInteger(n) && n >= limit.min && n <= limit.max ? null : limit.error;
    }
    case 'decimal': {
      const n = Number(text.replace(',', '.'));
      if (!Number.isFinite(n) || n < limit.min || n > limit.max) return limit.error;
      const frac = text.replace(',', '.').split('.')[1] ?? '';
      return frac.length <= limit.decimals ? null : limit.error;
    }
    case 'money': {
      const clean = text.replace(/\s/g, '').replace(',', '.');
      if (!/^\d+(\.\d+)?$/.test(clean)) return 'money.invalidAmount';
      const [intPart = '', frac = ''] = clean.split('.');
      if (frac.length > limit.decimals) return 'money.invalidAmount';
      if (intPart.length > 12 - limit.decimals) return 'money.invalidAmount';
      return Number(clean) > 0 ? null : 'money.invalidAmount';
    }
  }
}
