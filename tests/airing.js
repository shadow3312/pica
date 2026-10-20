const test = require('node:test');
const assert = require('node:assert/strict');
const { airate, isDense } = require('../src/core/airing.js');

test('two short sentences stay together, a paragraph is split into pairs', () => {
  assert.equal(airate('Un. Deux.'), 'Un. Deux.');
  assert.equal(airate('Un. Deux. Trois. Quatre. Cinq.'), 'Un. Deux.\n\nTrois. Quatre.\n\nCinq.');
});

test('a long sentence stays alone in its block', () => {
  const long = 'Ceci est une très longue phrase qui dépasse largement la limite fixée pour regrouper deux phrases ensemble dans le même bloc de texte.';
  assert.ok(long.length > 100);
  const veryLong = long + ' ' + long.replace('Ceci', 'Cela');
  assert.ok(veryLong.length > 200);
  assert.equal(airate(long + ' Courte. Autre.'), long + ' Courte.\n\nAutre.'); // 134 + 6 < 200 : regrouped
  assert.equal(airate(veryLong), long + '\n\n' + veryLong.slice(long.length + 1));
});

test('existing lines are separated by a blank line, never more than one', () => {
  assert.equal(airate('Ligne un.\nLigne deux.'), 'Ligne un. Ligne deux.'.length <= 200 ? 'Ligne un.\n\nLigne deux.' : '');
  assert.equal(airate('a\n\n\n\nb'), 'a\n\nb');
});

test('! ? … end a sentence, including closing quotation marks and parentheses', () => {
  assert.equal(airate('Vraiment ? Oui ! Super… Génial. Fin.'), 'Vraiment ? Oui !\n\nSuper… Génial.\n\nFin.');
  assert.equal(airate('Il dit « stop. » Elle part. Fin (vraiment). Après.'), 'Il dit « stop. » Elle part. Fin (vraiment).\n\nAprès.');
});

test('no split without an uppercase letter or digit after', () => {
  assert.equal(airate('Il a fini... puis il est parti. Fin.'), 'Il a fini... puis il est parti. Fin.');
  assert.equal(airate('Voir 1. un et 2. deux. Fin.'), 'Voir 1. un et 2. deux. Fin.');
});

test('abbreviations, initials, and dotted acronyms do not trigger splits', () => {
  const cases = [
    'Rendez-vous avec M. Dupont demain. Puis Mme Martin.',
    'Le Dr. Durand a validé. Ensuite Pr. Leroy.',
    'Signé J. Dupont, en 44 av. J.-C. Puis rien.',
    'Voir p. 12 et cf. Annexe. Suite.',
    'Comme e.g. Paris. Ou i.e. Lyon.',
  ];
  for (const text of cases) {
    const out = airate(text);
    assert.ok(!/\b(M|Dr|Pr|J|av|p|cf|e\.g|i\.e)\.\n/.test(out), JSON.stringify(out));
  }
  assert.equal(airate('Rendez-vous avec M. Dupont demain. Puis Mme Martin.'), 'Rendez-vous avec M. Dupont demain. Puis Mme Martin.');
});

test('URLs and decimal numbers do not trigger splits', () => {
  assert.equal(airate('Visite exemple.com/page. Puis 3.14 est pi.'), 'Visite exemple.com/page. Puis 3.14 est pi.');
  assert.equal(airate('Voir https://a.com/b.html. Merci.'), 'Voir https://a.com/b.html. Merci.');
});

test('an emoji or opening quotation mark starts a sentence', () => {
  assert.equal(airate('Nouveau. 🚀 Lancement. « Bravo » dit-il. Fin.'), 'Nouveau. 🚀 Lancement.\n\n« Bravo » dit-il. Fin.');
});

test('lists stay together and attached to an introduction ending in « : »', () => {
  assert.equal(airate('Voici :\n• un\n• deux\nConclusion.'), 'Voici :\n• un\n• deux\n\nConclusion.');
  assert.equal(airate('Intro.\n- a\n- b'), 'Intro.\n\n- a\n- b');
  assert.equal(airate('1. un\n2. deux'), '1. un\n2. deux');
});

test('a list line is not split into sentences', () => {
  assert.equal(airate('• Un. Deux. Trois. Quatre.'), '• Un. Deux. Trois. Quatre.');
});

test('idempotent', () => {
  const samples = [
    'Un. Deux. Trois. Quatre. Cinq.',
    'Voici :\n• un\n• deux\nConclusion. Fin. Encore.',
    'a\n\n\n\nb. c. d.',
    'M. Dupont arrive. Il est là ! Vraiment ? Oui. Non… Peut-être. 🚀 Go.',
    '',
    '   ',
  ];
  for (const s of samples) {
    const once = airate(s);
    assert.equal(airate(once), once, JSON.stringify(s));
  }
});

test('empty or whitespace-only input: empty string', () => {
  assert.equal(airate(''), '');
  assert.equal(airate(' \n \n'), '');
});

test('Windows line endings', () => {
  assert.equal(airate('a.\r\nb.'), 'a.\n\nb.');
});

test('Unicode-styled text passes through unchanged', () => {
  const s = '𝗚𝗿𝗮𝘀. 𝘐𝘵𝘢𝘭𝘪𝘲𝘶𝘦. Suite.';
  assert.equal(airate(s), '𝗚𝗿𝗮𝘀. 𝘐𝘵𝘢𝘭𝘪𝘲𝘶𝘦.\n\nSuite.');
});

test('isDense: only sufficiently long text that would change', () => {
  assert.equal(isDense('Court. Très court. Encore.'), false);
  const dense = Array.from({ length: 12 }, (_, i) => 'Phrase numéro ' + i + ' assez longue.').join(' ');
  assert.ok(dense.length >= 300);
  assert.equal(isDense(dense), true);
  assert.equal(isDense(airate(dense)), false);
});
