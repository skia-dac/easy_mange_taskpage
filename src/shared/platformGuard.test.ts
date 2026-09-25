import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * L'app doit se comporter pareil sur iPhone et Android. Les différences de plateforme
 * n'existent que dans les composants partagés et le module platform, jamais dans les écrans.
 */
it('aucun écran ne contient de code spécifique à une plateforme', () => {
  const allowed = ['src/shared/ui/', 'src/modules/platform/'];
  const files = execSync('git ls-files "src/**/*.ts" "src/**/*.tsx"', { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
  const offenders = files.filter(
    (f) =>
      !f.endsWith('.test.ts') &&
      !f.endsWith('.test.tsx') &&
      !allowed.some((a) => f.startsWith(a)) &&
      /Platform\.(OS|select)|Alert\.alert|clearButtonMode/.test(readFileSync(f, 'utf8')),
  );
  expect(offenders).toEqual([]);
});
