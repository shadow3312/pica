const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../src/core/templates.js');

const NOW = new Date(2026, 8, 24); // September 24, 2026

test('extractVariables: unique, in order, without automatic variables', () => {
  const text = 'Cohort {{cohorte}} on {{date}} — {{cohorte}} with {{ lieu }} and {{date_courte}}';
  assert.deepEqual(T.extractVariables(text), ['cohorte', 'lieu']);
});

test('extractVariables: no placeholder', () => {
  assert.deepEqual(T.extractVariables('Hello everyone'), []);
  assert.deepEqual(T.extractVariables(''), []);
});

test('extractVariables: accents, hyphens, underscores, digits', () => {
  assert.deepEqual(T.extractVariables('{{prénom}} {{nom-famille}} {{code_2}}'), ['prénom', 'nom-famille', 'code_2']);
});

test('extractVariables: malformed braces are ignored', () => {
  assert.deepEqual(T.extractVariables('{{}} {x} {{ }} {{a b}}'), []);
});

test('fill: automatic date in French', () => {
  assert.equal(T.fill('Le {{date}}', {}, NOW), 'Le 24 septembre 2026');
  assert.equal(T.fill('Le {{date_courte}}', {}, NOW), 'Le 24/09/2026');
});

test('fill: automatic variables are insensitive to case and spaces', () => {
  assert.equal(T.fill('{{ DATE_COURTE }}', {}, NOW), '24/09/2026');
});

test('fill: custom variables repeated everywhere', () => {
  assert.equal(T.fill('{{cohorte}}: congratulations to the {{cohorte}}!', { cohorte: 'C4' }, NOW), 'C4: congratulations to the C4!');
});

test('fill: variable without a value remains unchanged; an empty value replaces it with nothing', () => {
  assert.equal(T.fill('A {{x}} B', {}, NOW), 'A {{x}} B');
  assert.equal(T.fill('A {{x}} B', { x: '' }, NOW), 'A  B');
});

test('fill: $ and special patterns in the value are taken literally', () => {
  assert.equal(T.fill('Price {{p}}', { p: '$& $1 $$' }, NOW), 'Price $& $1 $$');
});

test('fill: a value containing {{...}} is not reinterpreted', () => {
  assert.equal(T.fill('{{a}}', { a: '{{date}}' }, NOW), '{{date}}');
});

test('fill: without values or now', () => {
  assert.equal(T.fill('Hello'), 'Hello');
  assert.equal(T.fill('{{x}}'), '{{x}}');
});

test('matchVariableAtEnd: complete variable at the end of the text', () => {
  assert.deepEqual(T.matchVariableAtEnd('The {{date}}'), { name: 'date', raw: '{{date}}' });
  assert.deepEqual(T.matchVariableAtEnd('{{ cohorte }}'), { name: 'cohorte', raw: '{{ cohorte }}' });
  assert.deepEqual(T.matchVariableAtEnd('a {{x}} b {{prénom-2}}'), { name: 'prénom-2', raw: '{{prénom-2}}' });
});

test('matchVariableAtEnd: nothing if the variable is not at the end of the text or is incomplete', () => {
  assert.equal(T.matchVariableAtEnd('{{date}} next'), null);
  assert.equal(T.matchVariableAtEnd('{{date}'), null);
  assert.equal(T.matchVariableAtEnd('{date}}'), null);
  assert.equal(T.matchVariableAtEnd('{{a b}}'), null);
  assert.equal(T.matchVariableAtEnd('{{}}'), null);
  assert.equal(T.matchVariableAtEnd(''), null);
});

test('fill: multi-line text is preserved', () => {
  assert.equal(T.fill('{{a}}\n\n{{b}}', { a: '1', b: '2' }, NOW), '1\n\n2');
});
