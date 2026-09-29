const test = require("node:test");
const assert = require("node:assert/strict");
const U = require("../src/core/unicode");

const U_MARK = "̲";
const S_MARK = "̶";

// Build styled version of a ASCII text, from starting point (upper, lower, digit) for each character type. If a character has no styled equivalent, it is left as-is.
const style = (str, { upper, lower, digit }) =>
  [...str]
    .map((ch) => {
      const c = ch.charCodeAt(0);
      if (c >= 65 && c <= 90) return String.fromCodePoint(upper + c - 65);
      if (c >= 97 && c <= 122) return String.fromCodePoint(lower + c - 97);
      if (c >= 48 && c <= 57 && digit)
        return String.fromCodePoint(digit + c - 48);
      return ch;
    })
    .join("");

const BOLD = { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec };
const ITALIC = { upper: 0x1d608, lower: 0x1d622 };
const BOLD_ITALIC = { upper: 0x1d63c, lower: 0x1d656, digit: 0x1d7ec };
const MONO = { upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 };

test("bold: encode, then back and forth", () => {
  const bold = U.toggle("Hello World 123", "bold");
  assert.equal(bold, style("Hello World 123", BOLD));
  assert.equal(U.toggle(bold, "bold"), "Hello World 123");
});

test("bold + italic gives bold-italic", () => {
  const both = U.toggle(U.toggle("Hello", "bold"), "italic");
  assert.equal(both, style("Hello", BOLD_ITALIC));
});

test("remove bold from bold-italic gives italic", () => {
  const bolditalic = style("Hello", BOLD_ITALIC);
  const italic = U.toggle(bolditalic, "bold");

  assert.equal(italic, style("Hello", ITALIC));
});

test("selection partially bold: bold should apply to all", () => {
    const mixed = "Hello " + style("World", BOLD);
    assert.equal(U.toggle(mixed, "bold"), style("Hello World", BOLD));
})

test('mono replace bold/italic', () => {
  assert.equal(U.toggle(style('Ab', BOLD), 'mono'), style('Ab', MONO));
  assert.equal(U.toggle(style('Ab', MONO), 'bold'), style('Ab', BOLD));
});

test('digits : styled in bold/mono, unchanged in italic', () => {
  assert.equal(U.toggle('12', 'bold'), style('12', BOLD));
  assert.equal(U.toggle('12', 'mono'), style('12', MONO));
  assert.equal(U.toggle('123', 'italic'), '123');
});

test('letters with accents left as is', () => {
  assert.equal(U.toggle('é', 'bold'), 'é');
  assert.equal(U.toggle('été a', 'bold'), 'é' + style('t', BOLD) + 'é ' + style('a', BOLD));
});

test('text without target returned as is', () => {
  assert.equal(U.toggle('', 'bold'), '');
  assert.equal(U.toggle('...', 'bold'), '...');
});

test('unknown format : error', () => {
  assert.throws(() => U.toggle('a', 'nope'), /Format inconnu/);
});

test('underline and strike: combining marks are reversible', () => {
  const u = U.toggle('ab', 'underline');
  assert.equal(u, 'a' + U_MARK + 'b' + U_MARK);
  assert.equal(U.toggle(u, 'underline'), 'ab');
  const s = U.toggle('ab', 'strike');
  assert.equal(s, 'a' + S_MARK + 'b' + S_MARK);
  assert.equal(U.toggle(s, 'strike'), 'ab');
});

test('underline ignores line breaks', () => {
  assert.equal(U.toggle('a\nb', 'underline'), 'a' + U_MARK + '\nb' + U_MARK);
});

test('underline preserves combining marks', () => {
  const out = U.toggle('a' + U_MARK, 'bold');
  assert.equal(out, style('a', BOLD) + U_MARK);
});

test('clear remove all styles', () => {
  let s = U.toggle('Test 42', 'bold');
  s = U.toggle(s, 'underline');
  s = U.toggle(s, 'strike');
  assert.equal(U.clear(s), 'Test 42');
  assert.equal(U.clear(style('Test 42', MONO)), 'Test 42');
});

test('décodage des variantes serif et du trou U+210E', () => {
  assert.equal(U.clear('\u{1D41A}'), 'a');     // serif bold
  assert.equal(U.clear('\u{1D44E}'), 'a');     // serif italic
  assert.equal(U.clear('\u{1D482}'), 'a');     // serif bold-italic
  assert.equal(U.clear('ℎ'), 'h');
});

test('clear preserves accents (NFC)', () => {
  assert.equal(U.clear('été'), 'été');
});

test('bullets : addition, removal, empty lines ignored', () => {
  const list = U.toggleList('a\n\nb', 'bullets');
  assert.equal(list, '• a\n\n• b');
  assert.equal(U.toggleList(list, 'bullets'), 'a\n\nb');
});

test('numbered: numbering continues, indentation removed', () => {
  const list = U.toggleList('a\n\nb', 'numbered');
  assert.equal(list, '1. a\n\n2. b');
  assert.equal(U.toggleList(list, 'numbered'), 'a\n\nb');
  assert.equal(U.toggleList('1) a\n2) b', 'numbered'), 'a\nb');
});

test('switching from bullets to numbers replaces the prefix', () => {
  assert.equal(U.toggleList('• a\n• b', 'numbered'), '1. a\n2. b');
});

test('setStyle : force a style regardless of the current state', () => {
  assert.equal(U.setStyle('Ab', { bold: true }), style('Ab', BOLD));
  assert.equal(U.setStyle(style('Ab', BOLD), { bold: true }), style('Ab', BOLD)); // already bold, no change
  assert.equal(U.setStyle(style('Ab', BOLD), { bold: false }), 'Ab'); // remove, do not toggle
});

test('setStyle : combine many styles in one call', () => {
  assert.equal(U.setStyle('Ab', { bold: true, italic: true }), style('Ab', BOLD_ITALIC));
});

test('setStyle : unknown format throws an error', () => {
  assert.throws(() => U.setStyle('a', { nope: true }), /Format inconnu/);
});

test('liste : empty input unchanged', () => {
  assert.equal(U.toggleList('', 'bullets'), '');
  assert.equal(U.toggleList('\n\n', 'numbered'), '\n\n');
});