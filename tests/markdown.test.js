// Tests de l'export Markdown : `node --test`
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../src/core/unicode.js');
const MD = require('../src/core/markdown.js');

test('bold, italic, bold-italic, mono', () => {
  assert.equal(MD.toMarkdown(U.toggle('Bonjour', 'bold')), '**Bonjour**');
  assert.equal(MD.toMarkdown(U.toggle('Bonjour', 'italic')), '_Bonjour_');
  assert.equal(MD.toMarkdown(U.toggle(U.toggle('Bonjour', 'bold'), 'italic')), '***Bonjour***');
  assert.equal(MD.toMarkdown(U.toggle('Bonjour', 'mono')), '`Bonjour`');
});

test('underline -> <u>, strike -> ~~', () => {
  assert.equal(MD.toMarkdown(U.toggle('Bonjour', 'underline')), '<u>Bonjour</u>');
  assert.equal(MD.toMarkdown(U.toggle('Bonjour', 'strike')), '~~Bonjour~~');
});

test('combined styles : bold + underline', () => {
  const styled = U.toggle(U.toggle('Bonjour', 'bold'), 'underline');
  assert.equal(MD.toMarkdown(styled), '<u>**Bonjour**</u>');
});

test('not styled text remains unchanged', () => {
  assert.equal(MD.toMarkdown('Bonjour tout le monde'), 'Bonjour tout le monde');
  assert.equal(MD.toMarkdown(''), '');
});

test('mixed styled / not styled text in the same sentence', () => {
  const mixed = U.toggle('important', 'bold');
  assert.equal(MD.toMarkdown('Ceci est ' + mixed + ' à retenir'),
    'Ceci est **important** à retenir');
});

test('spaces at the edges of styled text remain outside the markers', () => {
  const styled = ' ' + U.toggle('Bonjour', 'bold') + ' ';
  assert.equal(MD.toMarkdown(styled), ' **Bonjour** ');
});

test('styled digits (bold)', () => {
  assert.equal(MD.toMarkdown(U.toggle('42', 'bold')), '**42**');
});

test('accented letters outside styles remain literal', () => {
  assert.equal(MD.toMarkdown('été'), 'été');
  const mixed = 'é' + U.toggle('t', 'bold') + 'é';
  assert.equal(MD.toMarkdown(mixed), 'é**t**é');
});

test('line-breaks preserved', () => {
  const styled = U.toggle('a', 'bold') + '\n' + U.toggle('b', 'italic');
  assert.equal(MD.toMarkdown(styled), '**a**\n_b_');
});

test('space between two words of the same style : a single marker block', () => {
  assert.equal(MD.toMarkdown(U.toggle('Bonjour test', 'bold')), '**Bonjour test**');
  assert.equal(MD.toMarkdown(U.toggle('a b c', 'bold')), '**a b c**');
});

test("space between two words of different style : no fusion", () => {
  const mixed = U.toggle('Bonjour', 'bold') + ' test';
  assert.equal(MD.toMarkdown(mixed), '**Bonjour** test');
});

test('fusion across a line break with the same style', () => {
  const styled = U.toggle('a', 'bold') + '\n' + U.toggle('b', 'bold');
  assert.equal(MD.toMarkdown(styled), '**a\nb**');
});

test('fromMarkdown : bold, italic, bold-italic, mono, strike, underline', () => {
  assert.equal(MD.fromMarkdown('**Bonjour**'), U.toggle('Bonjour', 'bold'));
  assert.equal(MD.fromMarkdown('_Bonjour_'), U.toggle('Bonjour', 'italic'));
  assert.equal(MD.fromMarkdown('***Bonjour***'), U.toggle(U.toggle('Bonjour', 'bold'), 'italic'));
  assert.equal(MD.fromMarkdown('`Bonjour`'), U.toggle('Bonjour', 'mono'));
  assert.equal(MD.fromMarkdown('~~Bonjour~~'), U.toggle('Bonjour', 'strike'));
  assert.equal(MD.fromMarkdown('<u>Bonjour</u>'), U.toggle('Bonjour', 'underline'));
});

test('fromMarkdown :combined styles (underline nesting bold)', () => {
  assert.equal(MD.fromMarkdown('<u>**Bonjour**</u>'),
    U.toggle(U.toggle('Bonjour', 'bold'), 'underline'));
});

test('fromMarkdown : mixed Markdown / plain text', () => {
  assert.equal(MD.fromMarkdown('Ceci est **important** à retenir'),
    'Ceci est ' + U.toggle('important', 'bold') + ' à retenir');
});

test('fromMarkdown : text without markers unchanged', () => {
  assert.equal(MD.fromMarkdown('Bonjour tout le monde'), 'Bonjour tout le monde');
});

test('back-and-forth toMarkdown -> fromMarkdown', () => {
  const cases = ['Bonjour test', 'a b c'];
  for (const c of cases) {
    for (const fmt of ['bold', 'italic', 'mono', 'underline', 'strike']) {
      const styled = U.toggle(c, fmt);
      assert.equal(MD.fromMarkdown(MD.toMarkdown(styled)), styled, `${fmt} / ${c}`);
    }
  }
});

test('looksLikeMarkdown : detects markers, ignores plain text', () => {
  assert.equal(MD.looksLikeMarkdown('**bold**'), true);
  assert.equal(MD.looksLikeMarkdown('_italic_'), true);
  assert.equal(MD.looksLikeMarkdown('`mono`'), true);
  assert.equal(MD.looksLikeMarkdown('~~strike~~'), true);
  assert.equal(MD.looksLikeMarkdown('<u>underline</u>'), true);
  assert.equal(MD.looksLikeMarkdown('Bonjour tout le monde'), false);
  assert.equal(MD.looksLikeMarkdown(U.toggle('Bonjour', 'bold')), false);
});
