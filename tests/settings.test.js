// Settings tests: `node --test`
const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULTS, createSettings } = require('../src/core/settings.js');

function memoryAdapter(initial) {
  const data = { ...initial };
  return {
    data,
    get: async key => { await new Promise(r => setTimeout(r, 1)); return data[key]; },
    set: async (key, value) => { await new Promise(r => setTimeout(r, 1)); data[key] = value; },
  };
}

test('before load(): default values', () => {
  const s = createSettings(memoryAdapter());
  assert.deepEqual(s.all(), DEFAULTS);
  for (const name of s.names) assert.equal(typeof s.get(name), 'boolean');
});

test('all settings are enabled by default (historical behavior preserved)', () => {
  for (const [name, value] of Object.entries(DEFAULTS)) assert.equal(value, true, name);
});

test('load(): applies stored changes', async () => {
  const s = createSettings(memoryAdapter({ settings: { drafts: false } }));
  await s.load();
  assert.equal(s.get('drafts'), false);
  assert.equal(s.get('templates'), true);
});

test('load(): empty storage', async () => {
  const s = createSettings(memoryAdapter());
  await s.load();
  assert.deepEqual(s.all(), DEFAULTS);
});

test('unexpected stored data is ignored and never fatal', async () => {
  for (const bad of ['text', 42, null, [], [true], { drafts: 'no', templates: 0, unknown: false }]) {
    const s = createSettings(memoryAdapter({ settings: bad }));
    await s.load();
    assert.deepEqual(s.all(), DEFAULTS, JSON.stringify(bad));
  }
});

test('valid and invalid values in the same object: only the valid one counts', async () => {
  const s = createSettings(memoryAdapter({ settings: { drafts: false, templates: 'yes' } }));
  await s.load();
  assert.equal(s.get('drafts'), false);
  assert.equal(s.get('templates'), true);
});

test('set(): updates the cache and stores only the change', async () => {
  const adapter = memoryAdapter();
  const s = createSettings(adapter);
  await s.set('drafts', false);
  assert.equal(s.get('drafts'), false);
  assert.deepEqual(adapter.data.settings, { drafts: false });
});

test('set(): preserves other stored changes', async () => {
  const adapter = memoryAdapter({ settings: { templates: false } });
  const s = createSettings(adapter);
  await s.set('drafts', false);
  assert.deepEqual(adapter.data.settings, { templates: false, drafts: false });
});

test('set(): unknown name or non-boolean value -> error', () => {
  const s = createSettings(memoryAdapter());
  assert.throws(() => s.set('anything', true), /Unknown setting/);
  assert.throws(() => s.get('anything'), /Unknown setting/);
  assert.throws(() => s.set('drafts', 'yes'), /boolean/);
});

test('onChange: called only when the value actually changes', async () => {
  const s = createSettings(memoryAdapter());
  const seen = [];
  s.onChange((name, value) => seen.push([name, value]));
  await s.set('drafts', false);
  await s.set('drafts', false);     // no change
  await s.set('drafts', true);
  assert.deepEqual(seen, [['drafts', false], ['drafts', true]]);
});

test('onChange: unsubscribe', async () => {
  const s = createSettings(memoryAdapter());
  const seen = [];
  const off = s.onChange((name, value) => seen.push([name, value]));
  off();
  await s.set('drafts', false);
  assert.deepEqual(seen, []);
});

test('onChange: an error in a subscriber does not prevent others', async () => {
  const s = createSettings(memoryAdapter());
  const seen = [];
  const original = console.error;
  console.error = () => {};
  try {
    s.onChange(() => { throw new Error('boom'); });
    s.onChange((name, value) => seen.push([name, value]));
    await s.set('templates', false);
  } finally {
    console.error = original;
  }
  assert.deepEqual(seen, [['templates', false]]);
});

test('applyExternal: another context changed a setting', () => {
  const s = createSettings(memoryAdapter());
  const seen = [];
  s.onChange((name, value) => seen.push([name, value]));
  s.applyExternal({ markdownTyping: false });
  assert.equal(s.get('markdownTyping'), false);
  assert.deepEqual(seen, [['markdownTyping', false]]);
});

test('applyExternal: removing the stored value returns to defaults', () => {
  const s = createSettings(memoryAdapter());
  s.applyExternal({ drafts: false });
  s.applyExternal(undefined);
  assert.equal(s.get('drafts'), true);
});

test('all() returns a copy', () => {
  const s = createSettings(memoryAdapter());
  s.all().drafts = false;
  assert.equal(s.get('drafts'), true);
});

test('DEFAULTS is frozen', () => {
  assert.ok(Object.isFrozen(DEFAULTS));
});

test('simultaneous writes: none is lost', async () => {
  const adapter = memoryAdapter();
  const s = createSettings(adapter);
  await Promise.all([s.set('drafts', false), s.set('templates', false), s.set('markdownTyping', false)]);
  assert.deepEqual(adapter.data.settings, { drafts: false, templates: false, markdownTyping: false });
});

test('an adapter error does not block subsequent operations', async () => {
  const adapter = memoryAdapter();
  let fail = true;
  const realSet = adapter.set;
  adapter.set = async (k, v) => { if (fail) throw new Error('quota'); return realSet(k, v); };
  const s = createSettings(adapter);
  await assert.rejects(s.set('drafts', false), /quota/);
  assert.equal(s.get('drafts'), true, 'the cache must not change if the write fails');
  fail = false;
  await s.set('drafts', false);
  assert.equal(s.get('drafts'), false);
});

test('configurable storage key', async () => {
  const adapter = memoryAdapter();
  const s = createSettings(adapter, { key: 'other' });
  await s.set('drafts', false);
  assert.deepEqual(adapter.data.other, { drafts: false });
  assert.equal(adapter.data.settings, undefined);
});
