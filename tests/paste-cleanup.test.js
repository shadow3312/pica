// Paste cleaner tests: `node --test`
const test = require('node:test');
const assert = require('node:assert/strict');
const { clean } = require('../src/core/paste-cleanup.js');

test('Windows / Mac / Unicode line endings normalized to \\n', () => {
  assert.equal(clean('a\r\nb\rc\u2028d\u2029e'), 'a\nb\nc\nd\ne');
});

test('invisible characters removed, emoji joiner preserved', () => {
  assert.equal(clean('a\u200Bb\uFEFFc\u00ADd\u2060e'), 'abcde');
  assert.equal(clean('👨‍👩'), '👨‍👩');
});

test('exotic spaces converted to spaces; French non-breaking spaces preserved', () => {
  assert.equal(clean('a\u2003b\u3000c'), 'a b c');
  assert.equal(clean('Quoi ? Ok : oui'), 'Quoi ? Ok : oui');
});

test('repeated spaces, tabs, and line margins', () => {
  assert.equal(clean('a   b\t\tc'), 'a b c');
  assert.equal(clean('  un  \n\tdeux   \n trois'), 'un\ndeux\ntrois');
});

test('single line: leading and trailing spaces are preserved (pasting inside a sentence)', () => {
  assert.equal(clean(' monde'), ' monde');
  assert.equal(clean('bonjour '), 'bonjour ');
  assert.equal(clean('  monde  '), ' monde ');
});

test('blank lines: at most one, none at the edges', () => {
  assert.equal(clean('a\n\n\n\n\nb'), 'a\n\nb');
  assert.equal(clean('\n\n a\nb \n\n'), 'a\nb');
  assert.equal(clean('a\n \n \nb'), 'a\n\nb');
});

test('Word and PDF bullets normalized to "•"', () => {
  assert.equal(clean('■ un\n● deux\n○ trois\n▪ quatre\n➢ cinq\n\uF0B7 six\n\uF0A7\tsept'),
    '• un\n• deux\n• trois\n• quatre\n• cinq\n• six\n• sept');
  assert.equal(clean('   ● indentée'), '• indentée');
});

test('already-correct dashes, asterisks, and bullets left unchanged', () => {
  const same = '- un\n– deux\n— trois\n* quatre\n• cinq';
  assert.equal(clean(same), same);
});

test('a bullet symbol in the middle of a line is not a bullet', () => {
  assert.equal(clean('note ● importante'), 'note ● importante');
});

test('words split at line endings are rejoined only when the continuation is lowercase', () => {
  assert.equal(clean('une informa-\ntion utile'), 'une information utile');
  assert.equal(clean('une informa- \n  tion'), 'une information');
  assert.equal(clean('Jean-\nPierre'), 'Jean-\nPierre');
  assert.equal(clean('a -\nb'), 'a -\nb');
  assert.equal(clean('1990-\n2000'), '1990-\n2000');
});

test('exotic dashes and low quotation marks', () => {
  assert.equal(clean('a‐b‑c‒d'), 'a-b-c-d');
  assert.equal(clean('―'), '—');
  assert.equal(clean('„mot‟ et ‚x‛'), '"mot" et \'x\'');
});

test('typographic quotation marks and apostrophes preserved', () => {
  const same = '« mot » “deux” l’été ‘trois’';
  assert.equal(clean(same), same);
});

test('URLs: tracking parameters removed, others preserved', () => {
  assert.equal(clean('https://ex.com/a?utm_source=x&id=3&fbclid=abc'), 'https://ex.com/a?id=3');
  assert.equal(clean('https://ex.com/a?utm_source=x&utm_medium=y'), 'https://ex.com/a');
  assert.equal(clean('https://ex.com/a?gclid=1#haut'), 'https://ex.com/a#haut');
  assert.equal(clean('https://ex.com/a?q=chat&page=2'), 'https://ex.com/a?q=chat&page=2');
  assert.equal(clean('https://ex.com/?UTM_Campaign=x'), 'https://ex.com/');
});

test('URLs: sentence-ending punctuation and parentheses excluded from the address', () => {
  assert.equal(clean('Voir https://ex.com/a?utm_source=x.'), 'Voir https://ex.com/a.');
  assert.equal(clean('(https://ex.com/?fbclid=1)'), '(https://ex.com/)');
  assert.equal(clean('Voir https://ex.com/a?id=1, puis'), 'Voir https://ex.com/a?id=1, puis');
});

test('LinkedIn URL: tracking parameters removed', () => {
  assert.equal(clean('https://www.linkedin.com/posts/x?trk=public_post&utm_source=share&rcm=ACo'),
    'https://www.linkedin.com/posts/x');
});

test('idempotent, including for dirty text', () => {
  const dirty = ' \uFEFF● une  informa-\ntion\u2003\r\n\r\n\r\n\r\n■ deux https://ex.com/?utm_x=1&a=2. \t\n\n';
  const once = clean(dirty);
  assert.equal(clean(once), once);
});

test('already-clean text remains unchanged, including Unicode-styled text', () => {
  for (const s of ['', 'Bonjour', 'Salut 𝗴𝗿𝗮𝘀 et 𝘪𝘵𝘢𝘭𝘪𝘲𝘶𝘦 🚀', 'a\n\nb', '• un\n• deux', 'a̲b̲ S̶']) {
    assert.equal(clean(s), s, JSON.stringify(s));
  }
});
