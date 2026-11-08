import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/**
 * Tout formulaire de `src/app` qui enregistre une saisie demande « Abandonner les modifications ? »
 * avant de partir (et sort sans question après un enregistrement). Les écrans de connexion
 * (`auth/`) n'ont pas de données à perdre : mot de passe et e-mail ne sont pas gardés exprès.
 */
it('chaque formulaire de src/app est protégé par useUnsavedGuard', () => {
  const files = execSync('git ls-files "src/app/**/*.tsx"', { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !f.includes('__tests__') && !f.startsWith('src/app/auth/'));
  const forms = files.filter((f) => /<FormScreen\b/.test(readFileSync(f, 'utf8')));
  expect(forms.length).toBeGreaterThan(15);
  const unguarded = forms.filter((f) => !/useUnsavedGuard\(/.test(readFileSync(f, 'utf8')));
  expect(unguarded).toEqual([]);
});

it('après un enregistrement, les formulaires protégés sortent par `leave(...)`', () => {
  const files = execSync('git ls-files "src/app/**/*.tsx"', { encoding: 'utf8' })
    .split('\n')
    .filter((f) => f && !f.includes('__tests__'));
  const missing = files.filter((f) => {
    const src = readFileSync(f, 'utf8');
    // `const leave = useUnsavedGuard(…)` : la sortie voulue passe par `leave`.
    return (
      /const leave = useUnsavedGuard\(/.test(src) &&
      !/leave\(/.test(src.split('useUnsavedGuard(')[1] ?? '')
    );
  });
  expect(missing).toEqual([]);
});
