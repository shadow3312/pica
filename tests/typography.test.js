const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/core/typography.js');

const NNBSP = " "; // narrow non-breaking space (before ; : ! ?)
const NBSP = " ";

test('non-breaking space before  ! ; ?', () => {
  assert.equal(T.apply('Bonjour !'), 'Bonjour' + NNBSP + '!');
  assert.equal(T.apply('Salut ;'), 'Salut' + NNBSP + ';');
  assert.equal(T.apply('Ça va ?'), 'Ça va' + NNBSP + '?');
});

test('non-breaking space before punctuation', () => {
    assert.equal(T.apply('Bonjour!'), 'Bonjour' + NNBSP + '!');
});

test('non-breaking space before :', () => {
    assert.equal(T.apply('Titre : contenu'), 'Titre' + NBSP + ': contenu');
});

test("Multiple punctuation marks are handled correctly", () => {
    assert.equal(T.apply('Quoi ?!'), 'Quoi' + NNBSP + '?' + NNBSP + '!');
})

test('right apostrophe -> curvy apostrophe between letters', () => {
  assert.equal(T.apply("l'écran"), 'l’écran');
  assert.equal(T.apply("aujourd'hui"), 'aujourd’hui');
});

test('right guillemets -> french guillemets', () => {
  assert.equal(T.apply('Il a dit "bonjour" hier'), 'Il a dit «' + NNBSP + 'bonjour' + NNBSP + '» hier');
});

test('idempotent : applying twice doesnt change the result', () => {
  const cases = ['Bonjour !', 'Titre : contenu', "l'écran", 'Il a dit "bonjour" hier', 'Quoi ?!'];
  for (const c of cases) {
    const once = T.apply(c);
    assert.equal(T.apply(once), once, 'non idempotent pour : ' + c);
  }
});

test('text without punctuation is left unchanged', () => {
  assert.equal(T.apply('Bonjour tout le monde'), 'Bonjour tout le monde');
  assert.equal(T.apply(''), '');
});

test("doesnt affect the apostrophe at the end of a word (plural in English, etc.)", () => {
  assert.equal(T.apply("the dogs' toy"), "the dogs' toy");
});