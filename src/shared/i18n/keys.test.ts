import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import fr from './locales/fr.json';

/** Toute clé `t('x.y')` écrite dans le code doit exister dans fr.json (sinon l'écran affiche la clé brute). */
it('toutes les clés de traduction utilisées dans le code existent', () => {
  const files = execSync('git ls-files "src/**/*.ts" "src/**/*.tsx"', { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const missing = new Set<string>();
  const exists = (key: string) =>
    key
      .split('.')
      .reduce<unknown>(
        (o, p) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[p] : undefined),
        fr,
      ) !== undefined;
  for (const f of files) {
    if (f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue;
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
      if (!exists(m[1]!)) missing.add(`${f}: ${m[1]}`);
    }
    for (const m of src.matchAll(/\bt\(\s*`([a-zA-Z0-9_.]+)\.\$\{/g)) {
      // clés dynamiques `prefix.${x}` : le préfixe doit exister
      if (!exists(m[1]!)) missing.add(`${f}: ${m[1]}.*`);
    }
  }
  expect([...missing]).toEqual([]);
});
