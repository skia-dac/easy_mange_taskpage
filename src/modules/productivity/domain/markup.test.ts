import {
  continueListOnEnter,
  parseBlocks,
  parseInlines,
  toggleCheckbox,
  toggleLinePrefix,
  wrapSelection,
} from './markup';
import { noteDisplayTitle, notePreview } from './note';

describe('mise en forme légère des notes (§46)', () => {
  it('analyse gras et italique', () => {
    expect(parseInlines('Les **4P** du _marketing_')).toEqual([
      { text: 'Les ' },
      { text: '4P', bold: true },
      { text: ' du ' },
      { text: 'marketing', italic: true },
    ]);
  });

  it('analyse titres, listes, numéros et cases', () => {
    const blocks = parseBlocks('# Cours\n- a\n1. b\n[ ] c\n- [x] d\n\ntexte');
    expect(blocks.map((b) => b.type)).toEqual([
      'heading',
      'bullet',
      'numbered',
      'check',
      'check',
      'blank',
      'paragraph',
    ]);
    expect(blocks[3]).toMatchObject({ checked: false });
    expect(blocks[4]).toMatchObject({ checked: true, line: 4 });
  });

  it('gras : entoure la sélection, ou insère les marques', () => {
    expect(wrapSelection('un mot', { start: 3, end: 6 }, '**')).toEqual({
      content: 'un **mot**',
      selection: { start: 5, end: 8 },
    });
    expect(wrapSelection('ab', { start: 1, end: 1 }, '_')).toEqual({
      content: 'a__b',
      selection: { start: 2, end: 2 },
    });
  });

  it('préfixe de ligne : ajoute puis retire', () => {
    const on = toggleLinePrefix('ligne', { start: 2, end: 2 }, 'bullet');
    expect(on.content).toBe('- ligne');
    expect(toggleLinePrefix(on.content, on.selection, 'bullet').content).toBe('ligne');
    expect(toggleLinePrefix('- ligne', { start: 3, end: 3 }, 'check').content).toBe('[ ] ligne');
    expect(toggleLinePrefix('1. a\nb', { start: 5, end: 5 }, 'numbered').content).toBe(
      '1. a\n2. b',
    );
  });

  it('coche et décoche une case sans éditeur', () => {
    expect(toggleCheckbox('[ ] a\n[x] b', 0)).toBe('[x] a\n[x] b');
    expect(toggleCheckbox('[ ] a\n[x] b', 1)).toBe('[ ] a\n[ ] b');
  });

  it('Entrée continue une liste et une ligne vide la termine', () => {
    const c = '- a';
    expect(continueListOnEnter(c, { start: 3, end: 3 })?.content).toBe('- a\n- ');
    expect(continueListOnEnter('2. b', { start: 4, end: 4 })?.content).toBe('2. b\n3. ');
    expect(continueListOnEnter('- ', { start: 2, end: 2 })).toEqual({
      content: '',
      selection: { start: 0, end: 0 },
    });
    expect(continueListOnEnter('texte', { start: 5, end: 5 })).toBeNull();
  });
});

describe('titre et aperçu d’une note', () => {
  it('utilise la première ligne si pas de titre', () => {
    expect(noteDisplayTitle({ title: '', content: '# Les 4P\ndétails' })).toBe('Les 4P');
    expect(notePreview({ title: '', content: '# Les 4P\n- **produit**\n- prix' })).toBe(
      'produit prix',
    );
    expect(notePreview({ title: 'T', content: 'a\nb' })).toBe('a b');
  });
});
