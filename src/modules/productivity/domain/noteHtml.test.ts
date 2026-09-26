import { noteToHtml } from './noteHtml';

describe('note → HTML (PDF)', () => {
  it('rend la mise en forme légère et échappe le texte', () => {
    const html = noteToHtml(
      '# Titre <b>\n**gras** et _italique_\n- un\n- deux\n1. trois\n[x] fait\n[ ] à faire',
      {
        title: 'Ma <note>',
        subtitle: 'Marketing',
        footer: 'MySky',
      },
    );
    expect(html).toContain('<h1>Ma &lt;note&gt;</h1>');
    expect(html).toContain('<h2>Titre &lt;b&gt;</h2>');
    expect(html).toContain('<strong>gras</strong> et <em>italique</em>');
    expect(html).toContain('<ul>\n<li>un</li>\n<li>deux</li>\n</ul>');
    expect(html).toContain('<ol>\n<li>trois</li>\n</ol>');
    expect(html).toContain('&#9745; fait');
    expect(html).toContain('&#9744; à faire');
    expect(html).not.toContain('<b>');
  });
});
