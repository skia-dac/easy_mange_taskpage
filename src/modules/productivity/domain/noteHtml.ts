import { parseBlocks, type Inline } from './markup';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlines(list: Inline[]): string {
  return list
    .map((i) => {
      let t = escapeHtml(i.text);
      if (i.bold) t = `<strong>${t}</strong>`;
      if (i.italic) t = `<em>${t}</em>`;
      return t;
    })
    .join('');
}

export type NoteHtmlMeta = { title: string; subtitle?: string; footer?: string };

/**
 * Page HTML imprimable d'une note (pour le PDF) : même mise en forme légère que l'app,
 * texte échappé, aucune ressource externe.
 */
export function noteToHtml(content: string, meta: NoteHtmlMeta): string {
  const body: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  const close = () => {
    if (list) body.push(`</${list}>`);
    list = null;
  };
  const open = (kind: 'ul' | 'ol') => {
    if (list !== kind) {
      close();
      body.push(`<${kind}>`);
      list = kind;
    }
  };
  for (const b of parseBlocks(content)) {
    switch (b.type) {
      case 'heading':
        close();
        body.push(`<h${b.level + 1}>${inlines(b.inlines)}</h${b.level + 1}>`);
        break;
      case 'paragraph':
        close();
        body.push(`<p>${inlines(b.inlines)}</p>`);
        break;
      case 'bullet':
        open('ul');
        body.push(`<li>${inlines(b.inlines)}</li>`);
        break;
      case 'numbered':
        open('ol');
        body.push(`<li>${inlines(b.inlines)}</li>`);
        break;
      case 'check':
        open('ul');
        body.push(
          `<li class="check">${b.checked ? '&#9745;' : '&#9744;'} ${inlines(b.inlines)}</li>`,
        );
        break;
      case 'blank':
        close();
        break;
    }
  }
  close();
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(meta.title)}</title>
<style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;padding:32px;color:#111}
h1{font-size:26px;margin:0 0 4px} .sub{color:#666;margin:0 0 24px} h2{font-size:20px;margin:20px 0 6px}
h3{font-size:17px;margin:16px 0 4px} h4{font-size:15px;margin:12px 0 4px} p{margin:0 0 8px}
ul,ol{margin:0 0 8px;padding-left:22px} li.check{list-style:none;margin-left:-18px}
.footer{margin-top:32px;color:#999;font-size:11px}
</style></head><body>
<h1>${escapeHtml(meta.title)}</h1>
${meta.subtitle ? `<p class="sub">${escapeHtml(meta.subtitle)}</p>` : ''}
${body.join('\n')}
${meta.footer ? `<p class="footer">${escapeHtml(meta.footer)}</p>` : ''}
</body></html>`;
}
