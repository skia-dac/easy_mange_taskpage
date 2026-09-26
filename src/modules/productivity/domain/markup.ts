/**
 * Mise en forme légère des notes : analyse ligne par ligne, et petites transformations
 * utilisées par la barre d'outils de l'éditeur.
 */
export type Inline = { text: string; bold?: boolean; italic?: boolean };
export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; inlines: Inline[] }
  | { type: 'paragraph'; inlines: Inline[] }
  | { type: 'bullet'; inlines: Inline[] }
  | { type: 'numbered'; number: number; inlines: Inline[] }
  | { type: 'check'; checked: boolean; inlines: Inline[]; line: number }
  | { type: 'blank' };

export function parseInlines(text: string): Inline[] {
  const out: Inline[] = [];
  const re = /\*\*(.+?)\*\*|_(.+?)_/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) out.push({ text: m[2], italic: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

export function parseBlocks(content: string): Block[] {
  return content.split('\n').map((raw, line): Block => {
    const l = raw.trimEnd();
    if (l.trim() === '') return { type: 'blank' };
    const h = /^(#{1,3})\s+(.*)$/.exec(l);
    if (h)
      return {
        type: 'heading',
        level: h[1]!.length as 1 | 2 | 3,
        inlines: parseInlines(h[2] ?? ''),
      };
    const c = /^\s*(?:[-*]\s+)?\[([ xX])\]\s*(.*)$/.exec(l);
    if (c) return { type: 'check', checked: c[1] !== ' ', inlines: parseInlines(c[2] ?? ''), line };
    const n = /^\s*(\d+)\.\s+(.*)$/.exec(l);
    if (n) return { type: 'numbered', number: Number(n[1]), inlines: parseInlines(n[2] ?? '') };
    const b = /^\s*[-*]\s+(.*)$/.exec(l);
    if (b) return { type: 'bullet', inlines: parseInlines(b[1] ?? '') };
    return { type: 'paragraph', inlines: parseInlines(l) };
  });
}

export type Selection = { start: number; end: number };
export type Edit = { content: string; selection: Selection };

/** Entoure la sélection (ou insère la marque vide, curseur au milieu). */
export function wrapSelection(content: string, sel: Selection, mark: string): Edit {
  const before = content.slice(0, sel.start);
  const inner = content.slice(sel.start, sel.end);
  const after = content.slice(sel.end);
  if (inner.length === 0) {
    const pos = sel.start + mark.length;
    return { content: `${before}${mark}${mark}${after}`, selection: { start: pos, end: pos } };
  }
  return {
    content: `${before}${mark}${inner}${mark}${after}`,
    selection: { start: sel.start + mark.length, end: sel.end + mark.length },
  };
}

type LinePrefix = 'heading' | 'bullet' | 'numbered' | 'check';
const PREFIX_RE = /^(#{1,3}\s+|\s*(?:[-*]\s+)?\[[ xX]\]\s*|\s*\d+\.\s+|\s*[-*]\s+)/;

/** Ajoute ou retire un préfixe de ligne (titre, liste, liste numérotée, case) sur la ligne du curseur. */
export function toggleLinePrefix(content: string, sel: Selection, kind: LinePrefix): Edit {
  const lineStart = content.lastIndexOf('\n', sel.start - 1) + 1;
  const lineEndIdx = content.indexOf('\n', sel.start);
  const lineEnd = lineEndIdx === -1 ? content.length : lineEndIdx;
  const line = content.slice(lineStart, lineEnd);
  const current = PREFIX_RE.exec(line)?.[0] ?? '';
  const rest = line.slice(current.length);
  const already =
    (kind === 'heading' && current.startsWith('#')) ||
    (kind === 'check' && /\[[ xX]\]/.test(current)) ||
    (kind === 'numbered' && /^\s*\d+\./.test(current)) ||
    (kind === 'bullet' && /^\s*[-*]\s+$/.test(current));
  const prefix = already
    ? ''
    : kind === 'heading'
      ? '## '
      : kind === 'bullet'
        ? '- '
        : kind === 'check'
          ? '[ ] '
          : `${nextNumber(content, lineStart)}. `;
  const newLine = prefix + rest;
  const delta = newLine.length - line.length;
  return {
    content: content.slice(0, lineStart) + newLine + content.slice(lineEnd),
    selection: {
      start: Math.max(lineStart, sel.start + delta),
      end: Math.max(lineStart, sel.end + delta),
    },
  };
}

function nextNumber(content: string, lineStart: number): number {
  const prevEnd = lineStart - 1;
  if (prevEnd < 0) return 1;
  const prevStart = content.lastIndexOf('\n', prevEnd - 1) + 1;
  const m = /^\s*(\d+)\.\s+/.exec(content.slice(prevStart, prevEnd));
  return m ? Number(m[1]) + 1 : 1;
}

/** Coche ou décoche la case de la ligne donnée (en lecture, sans ouvrir l'éditeur). */
export function toggleCheckbox(content: string, line: number): string {
  const lines = content.split('\n');
  const l = lines[line];
  if (l === undefined) return content;
  lines[line] = /\[ \]/.test(l) ? l.replace('[ ]', '[x]') : l.replace(/\[[xX]\]/, '[ ]');
  return lines.join('\n');
}

/** Sur Entrée : continue la liste ou la checklist ; une ligne de liste vide termine la liste. */
export function continueListOnEnter(content: string, sel: Selection): Edit | null {
  const lineStart = content.lastIndexOf('\n', sel.start - 1) + 1;
  const line = content.slice(lineStart, sel.start);
  const m = /^(\s*)(?:([-*])\s+(\[[ xX]\]\s*)?|(\d+)\.\s+|(\[[ xX]\]\s*))(.*)$/.exec(line);
  if (!m) return null;
  const [, indent = '', bullet, bulletCheck, number, bareCheck, rest = ''] = m;
  if (rest.trim() === '') {
    // Ligne de liste vide : on sort de la liste.
    return {
      content: content.slice(0, lineStart) + content.slice(sel.end),
      selection: { start: lineStart, end: lineStart },
    };
  }
  const next = bulletCheck
    ? `${indent}${bullet} [ ] `
    : bareCheck
      ? `${indent}[ ] `
      : bullet
        ? `${indent}${bullet} `
        : `${indent}${Number(number) + 1}. `;
  const inserted = `\n${next}`;
  const pos = sel.start + inserted.length;
  return {
    content: content.slice(0, sel.start) + inserted + content.slice(sel.end),
    selection: { start: pos, end: pos },
  };
}
