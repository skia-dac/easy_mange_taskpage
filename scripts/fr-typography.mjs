// Typographie française dans fr.json : espace fine insécable (U+202F) avant ; ? ! et espace
// insécable (U+00A0) avant : et à l'intérieur des guillemets « ». Ne touche qu'aux VALEURS
// (jamais aux clés) et jamais à l'intérieur des {{variables}}.
//
//   node scripts/fr-typography.mjs          corrige le fichier
//   node scripts/fr-typography.mjs --check  échoue s'il reste une espace ordinaire
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const file = fileURLToPath(new URL('../src/shared/i18n/locales/fr.json', import.meta.url));

const NARROW = ' ';
const NBSP = ' ';

/** Corrige un morceau de texte sans variable. */
function fixText(text) {
  return text
    .replace(/ +([;?!])/g, `${NARROW}$1`)
    .replace(/ +:/g, `${NBSP}:`)
    .replace(/« +/g, `«${NBSP}`)
    .replace(/ +»/g, `${NBSP}»`);
}

/** Corrige une valeur, en laissant les {{variables}} telles quelles. */
export function fixValue(value) {
  return value
    .split(/(\{\{[^}]*\}\})/)
    .map((part) => (part.startsWith('{{') ? part : fixText(part)))
    .join('');
}

function walk(node, visit) {
  if (typeof node === 'string') return visit(node);
  if (Array.isArray(node)) return node.map((n) => walk(n, visit));
  if (node && typeof node === 'object') {
    return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v, visit)]));
  }
  return node;
}

const source = readFileSync(file, 'utf8');
const json = JSON.parse(source);
let changed = 0;
const fixed = walk(json, (v) => {
  const next = fixValue(v);
  if (next !== v) changed++;
  return next;
});

if (process.argv.includes('--check')) {
  if (changed > 0) {
    console.error(
      `fr.json : ${changed} texte(s) avec une espace ordinaire avant ; ? ! : ou dans « ».`,
    );
    process.exit(1);
  }
} else {
  writeFileSync(file, `${JSON.stringify(fixed, null, 2)}\n`);
  console.log(`fr.json : ${changed} texte(s) corrigé(s).`);
}
