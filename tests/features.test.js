const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/core/unicode.js');
const FT = require('../src/core/features.js');

test('history actions are registered with button and shortcut', () => {
    for (const id of ['bold','italic','underline','strike','mono','bullets','numbered']) {
        const f = FT.get(id);
        assert.ok(f, id + ' is registered');
        assert.ok(f.toolbar && f.toolbar.label, id + ' has a toolbar button');
        assert.ok(f.shortcut, id + ' has a shortcut');
    }
});

test("returns null for an unknown feature", () => {
    assert.strictEqual(FT.get('unknown'), null);
});

test("list() returns a copy of the registry", () => {
    const list1 = FT.list();
    list1.push({id:'foo', run: t=>t});
    const list2 = FT.list();
    assert.strictEqual(list2.find(f => f.id === 'foo'), undefined);
    assert.strictEqual(FT.get('foo'), null);
});

test("run() applies the feature's transformation", () => {
    assert.strictEqual(FT.run('bold', 'a'), '𝗮');
    assert.strictEqual(FT.run('clear', '𝗮'), 'a');
})

test('run() throws an error for an unknown feature', () => {
    assert.throws(() => FT.run('unknown', 'a'), /Feature inconnue/);
});

test('register throws an error for a duplicate feature', () => {
    assert.throws(() => FT.register({ id: 'bold', run: t => t }), /Feature already registered/);
});

test('register throws an error for a feature with no run or id', () => {
    assert.throws(() => FT.register({ id: 'foo' }), /missing run/);
    assert.throws(() => FT.register({ run: t => t }), /missing id/);
    assert.throws(() => FT.register({}), /missing id/);
})

test('matchesShortcut() distinguishes between shift and key', () => {
  const bold = FT.get('bold');
  assert.equal(FT.matchesShortcut(bold, { shiftKey: false }, 'b'), true);
  assert.equal(FT.matchesShortcut(bold, { shiftKey: true }, 'b'), false);
  assert.equal(FT.matchesShortcut(bold, { shiftKey: false }, 'i'), false);
});

test('matchesShortcut() acknowledges a shortcut based on e.code (AZERTY/QWERTY)', () => {
  const bullets = FT.get('bullets');
  assert.equal(FT.matchesShortcut(bullets, { shiftKey: true, code: 'Digit8' }, '*'), true);
  assert.equal(FT.matchesShortcut(bullets, { shiftKey: true, code: 'Digit7' }, '*'), false);
});

test('matchesShortcut() returns false for a feature with no shortcut', () => {
  assert.equal(FT.matchesShortcut(FT.get('clear'), { shiftKey: false }, 'c'), false);
});