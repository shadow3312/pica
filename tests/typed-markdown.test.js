// Tests for live-typed Markdown: `node --test`
const test = require('node:test');
const assert = require('node:assert/strict');
const TM = require('../src/core/typed-markdown.js');

const styleName = style => Object.keys(style).sort().join('+');

/**
 * Simulates typing text character by character, as the widget does: whenever a marker is typed,
 * detect() is queried with the current line text before the cursor, and the recognized
 * region is replaced (here with a marker-free placeholder, as the Unicode-styled version would).
 * Returns the final text and the conversions in order.
 */
function typeText(text) {
  let buffer = '';
  const hits = [];
  for (const ch of text) {
    buffer += ch;
    if (!TM.isMarker(ch)) continue;
    const lineStart = buffer.lastIndexOf('\n') + 1;
    const before = buffer.slice(lineStart);
    const hit = TM.detect(before);
    if (!hit) continue;
    hits.push(`${styleName(hit.style)}:${hit.inner}`);
    buffer = buffer.slice(0, lineStart + hit.start) + `⟦${hit.inner}⟧`;
  }
  return { buffer, hits };
}

// ---------- detect(): each syntax ----------

test('bold : **text**', () => {
  assert.deepEqual(TM.detect('Salut **gras**'), { start: 6, end: 14, inner: 'gras', style: { bold: true } });
});

test('italic : *text* and _text_', () => {
  assert.deepEqual(TM.detect('un *mot*'), { start: 3, end: 8, inner: 'mot', style: { italic: true } });
  assert.deepEqual(TM.detect('un _mot_'), { start: 3, end: 8, inner: 'mot', style: { italic: true } });
});

test('mono : `text`', () => {
  assert.deepEqual(TM.detect('du `code`'), { start: 3, end: 9, inner: 'code', style: { mono: true } });
});

test('strikethrough : ~~text~~', () => {
  assert.deepEqual(TM.detect('un ~~barré~~'), { start: 3, end: 12, inner: 'barré', style: { strike: true } });
});

test('bold-italic : ***text*** (takes priority over **bold**)', () => {
  assert.deepEqual(TM.detect('***tout***'), { start: 0, end: 10, inner: 'tout', style: { bold: true, italic: true } });
});

test('start of line, parentheses, quotes, punctuation before the marker', () => {
  assert.equal(TM.detect('**a**').start, 0);
  assert.equal(TM.detect('(**a**').start, 1);
  assert.equal(TM.detect('« *a*').start, 2);
  assert.equal(TM.detect('fin: **a**').start, 5);
});

test('inner text may contain spaces and accents', () => {
  assert.equal(TM.detect('**une phrase entière**').inner, 'une phrase entière');
  assert.equal(TM.detect('**été à Paris**').inner, 'été à Paris');
});

test('mono : a space at the edge is allowed (a code snippet can contain one)', () => {
  assert.equal(TM.detect('` x `').inner, ' x ');
});

test('only the end of the text counts: text after an already closed marker is not re-read', () => {
  assert.equal(TM.detect('**a** puis du texte'), null);
});

test('detect only triggers if the last character is a marker', () => {
  for (const s of ['**gras', 'texte', '', ' ', '**a** ']) assert.equal(TM.detect(s), null, JSON.stringify(s));
});

test('isMarker : a single character among * _ ` ~', () => {
  for (const ch of ['*', '_', '`', '~']) assert.equal(TM.isMarker(ch), true, ch);
  for (const ch of ['a', ' ', '**', '', '{', '}', '𝗴', null, undefined]) assert.equal(TM.isMarker(ch), false, String(ch));
});

// ---------- Simulated typing: conversion happens exactly at the closing marker ----------

test('typing : each syntax converts once, at its closing marker', () => {
  const cases = [
    ['Salut **gras** fin', ['bold:gras'], 'Salut ⟦gras⟧ fin'],
    ['Un *mot* ici', ['italic:mot'], 'Un ⟦mot⟧ ici'],
    ['Un _mot_ ici', ['italic:mot'], 'Un ⟦mot⟧ ici'],
    ['Du `code` ici', ['mono:code'], 'Du ⟦code⟧ ici'],
    ['Un ~~barré~~ ici', ['strike:barré'], 'Un ⟦barré⟧ ici'],
    ['***tout***', ['bold+italic:tout'], '⟦tout⟧'],
    ['**a** puis *b* puis `c` puis ~~d~~ puis _e_', ['bold:a', 'italic:b', 'mono:c', 'strike:d', 'italic:e'],
      '⟦a⟧ puis ⟦b⟧ puis ⟦c⟧ puis ⟦d⟧ puis ⟦e⟧'],
    ['ligne 1\n**gras** ligne 2', ['bold:gras'], 'ligne 1\n⟦gras⟧ ligne 2'],
  ];
  for (const [input, expectedHits, expectedText] of cases) {
    const { buffer, hits } = typeText(input);
    assert.deepEqual(hits, expectedHits, input);
    assert.equal(buffer, expectedText, input);
  }
});

test('typing : **bold** never passes through an intermediate italic conversion', () => {
  // When the first closing "*" is typed, the text ends in "**gras*": the opening "*" is preceded
  // by another "*", so this is not italic. There is only one conversion, at the end.
  assert.deepEqual(typeText('**gras**').hits, ['bold:gras']);
  assert.deepEqual(typeText('***gras***').hits, ['bold+italic:gras']);
});

test('typing : a single closing marker does not convert anything (**gras* then stop)', () => {
  assert.deepEqual(typeText('**gras*').hits, []);
  assert.deepEqual(typeText('***gras**').hits, []);
});

// ---------- False positives: these texts must NEVER be converted ----------

test('ordinary text corpus: no conversion', () => {
  const corpus = [
    // Identifiers, variable names, code
    'nom_variable_ici', 'snake_case_word_here', '__init__', 'x_1 et y_2', 'email_test@exemple.com', '#hash_tag_ici',
    'https://exemple.com/a_b_c', 'MAX_VALUE_INT', 'un_deux',
    // Mathematics, exponents, multiplication
    '2*3*4', '2**3**4', 'prix: 10*2', '5 * 3 * 2', 'a * b * c', 'x*y*z', '(a+b)*(c+d)*e',
    'arr[i]*w[j]*z', 'f(x)*g(x)*h', '{a}*{b}*c', '(a+b)**(c+d)**e',
    // Markdown lists and bullets
    '* item de liste', '* premier\n* second', '- point\n- autre',
    // Empty or incomplete markers
    '**', '****', '**  **', '* *', '_ _', '`', '``', '~~', '~~~~', '~~ ~~', '**gras', '*', '_', 'juste un ~ tilde',
    // Spaces at the edges
    '** a**', '**a **', '* a*', '*a *', '_ x_', '_x _', '~~ a~~',
    // Preceded immediately by a letter or digit (including accented characters)
    'é**a**', 'a**b**c', 'a*b*', 'mot_italique_', '3`x`',
    // Across multiple lines: markers do not cross a line break
    '**a\nb**', '_a\nb_',
    // Ordinary text
    'Bonjour, comment ça va ? Très bien merci !', 'Voir p. 12-14 (cf. fig. 3).', 'C:\\dossier\\fichier.txt',
  ];
  for (const text of corpus) {
    const { buffer, hits } = typeText(text);
    assert.deepEqual(hits, [], `« ${JSON.stringify(text)} » was converted (${hits.join(', ')})`);
    assert.equal(buffer, text, 'text must not change');
  }
});

test('a word underlined attached to a dash, bar, or quote is recognized correctly', () => {
  // Non-alphanumeric characters before the marker are valid boundaries.
  assert.deepEqual(typeText('rapide-*mot*').hits, ['italic:mot']);
  assert.deepEqual(typeText('a/**b**').hits, ['bold:b']);
  assert.deepEqual(typeText('"**b**"').hits, ['bold:b']);
});

test('historical regressions of the prototype', () => {
  // This text was converted to "nom𝘷𝘢𝘳𝘪𝘢𝘣𝘭𝘦ici" (with two underscores swallowed) before the boundary rule.
  assert.deepEqual(typeText('nom_variable_ici').hits, []);
  // An ordinary sentence with an isolated underscore.
  assert.deepEqual(typeText('un mot_ suivi').hits, []);
});

test('text already styled in Unicode inside is preserved as-is', () => {
  assert.equal(TM.detect('**𝘪𝘵**').inner, '𝘪𝘵');
});

test('detect does not modify anything and always returns consistent offsets', () => {
  for (const before of ['**a**', 'x **bb** ', 'un *mot*', '`c`', '~~s~~', '***t***', '_e_']) {
    const hit = TM.detect(before);
    if (!hit) continue;
    assert.ok(hit.start >= 0 && hit.end <= before.length && hit.start < hit.end, before);
    assert.ok(before.slice(hit.start, hit.end).includes(hit.inner), before);
  }
});


test('« - » followed by space becomes a bullet', () => {
  assert.equal(TM.detectBullet('- '), '• ');
  assert.equal(TM.detectBullet('- '), '• ');
});

test('no bullet elsewhere than at the beginning of a line, nor without a space', () => {
  for (const before of ['-', ' - ', 'a - ', '-- ', '-a ', '— ', '* ', '• ']) {
    assert.equal(TM.detectBullet(before), null, JSON.stringify(before));
  }
});
