// Audit des dépendances de production (étape CI `bun run audit:prod`).
//
// Échoue (code 1) dès qu'une faille de niveau élevé ou critique est trouvée,
// SAUF les advisories listées dans IGNORED, et les alertes qui n'existent
// qu'à cause d'elles (paquets qui en dépendent, comme `query-string` et
// `expo-router`). Toute autre faille élevée ou critique reste bloquante.
//
// Pourquoi l'exception : `expo-router@57` dépend de `query-string@7`, qui
// `require` `decode-uri-component@0.2`. La version corrigée (0.5.1) est un
// module ESM que `query-string@7` ne peut pas charger (testé : Node et Jest
// cassent). La correction arrive avec expo-router 58.
// À RETIRER au passage au SDK 58 (voir docs/SECURITY.md, section 6).
import { spawnSync } from 'node:child_process';

const IGNORED = [
  'GHSA-vcc3-ghjq-m6fr', // decode-uri-component : décodage exponentiel
  'GHSA-qr28-fpjm-wq7f', // decode-uri-component : remplacement quadratique
];

// `bun audit` : dépendances de production seulement, niveau élevé ou critique, exceptions ignorées.
// Code de sortie différent de 0 dès qu'une autre faille élevée ou critique est trouvée.
const run = spawnSync(
  'bun',
  ['audit', '--prod', '--audit-level=high', ...IGNORED.map((id) => `--ignore=${id}`)],
  { encoding: 'utf8', stdio: 'inherit' },
);
if (run.error) {
  console.error('audit:prod : `bun audit` n’a pas pu être lancé :', run.error.message);
  process.exit(1);
}
if (run.status !== 0) {
  console.error('audit:prod : failles élevées ou critiques à corriger (voir ci-dessus).');
  process.exit(run.status ?? 1);
}
console.log(
  `audit:prod : aucune faille élevée ou critique hors exceptions documentées (${IGNORED.join(', ')}).`,
);
