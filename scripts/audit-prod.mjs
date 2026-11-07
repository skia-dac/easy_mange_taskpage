// Audit des dépendances de production (étape CI `npm run audit:prod`).
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

const IGNORED = new Set([
  'GHSA-vcc3-ghjq-m6fr', // decode-uri-component : décodage exponentiel
  'GHSA-qr28-fpjm-wq7f', // decode-uri-component : remplacement quadratique
]);
const LEVELS = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const THRESHOLD = LEVELS.high;

const run = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  shell: process.platform === 'win32',
});

let report;
try {
  report = JSON.parse(run.stdout);
} catch {
  console.error('audit:prod : réponse illisible de `npm audit`.');
  console.error(run.stderr);
  process.exit(1);
}
if (report.error) {
  console.error('audit:prod : `npm audit` a échoué :', report.error.summary ?? report.error);
  process.exit(1);
}

const vulns = report.vulnerabilities ?? {};

function advisoryId(via) {
  const match = /GHSA(-[0-9a-z]{4}){3}/i.exec(via.url ?? '');
  return match ? `GHSA${match[0].slice(4).toLowerCase()}` : null;
}

// Niveau « réel » d'un paquet : ses advisories non ignorées et, récursivement,
// le niveau réel des paquets dont il hérite la faille.
const memo = new Map();
function effectiveLevel(name, stack = new Set()) {
  if (memo.has(name)) return memo.get(name);
  const vuln = vulns[name];
  if (!vuln || stack.has(name)) return LEVELS.info;
  stack.add(name);
  let level = LEVELS.info;
  for (const via of vuln.via ?? []) {
    if (typeof via === 'string') {
      level = Math.max(level, effectiveLevel(via, stack));
    } else if (!IGNORED.has(advisoryId(via))) {
      level = Math.max(level, LEVELS[via.severity] ?? LEVELS.critical);
    }
  }
  stack.delete(name);
  memo.set(name, level);
  return level;
}

const blocking = [];
const ignored = [];
for (const [name, vuln] of Object.entries(vulns)) {
  const reported = LEVELS[vuln.severity] ?? LEVELS.critical;
  if (reported < THRESHOLD) continue;
  if (effectiveLevel(name) >= THRESHOLD) blocking.push(`${name} (${vuln.severity})`);
  else ignored.push(`${name} (${vuln.severity})`);
}

if (ignored.length > 0) {
  console.log(`Exceptions documentées (docs/SECURITY.md §6) : ${ignored.join(', ')}`);
}
if (blocking.length > 0) {
  console.error(`Failles élevées ou critiques à corriger : ${blocking.join(', ')}`);
  process.exit(1);
}
console.log('audit:prod : aucune faille élevée ou critique hors exceptions documentées.');
