const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore } = require('../src/core/drafts.js');

// In-memory adapter with latency to reveal races between operations
function memoryAdapter() {
  const data = {};
  return {
    data,
    get: async key => { await new Promise(r => setTimeout(r, 1)); return data[key]; },
    set: async (key, value) => { await new Promise(r => setTimeout(r, 1)); data[key] = value; },
  };
}

function makeStore(options) {
  let t = 1000;
  const adapter = memoryAdapter();
  const store = createStore(adapter, Object.assign({ now: () => ++t }, options));
  return { store, adapter };
}

test('save then list: returns the draft with its timestamp', async () => {
  const { store } = makeStore();
  await store.save('a', 'Hello');
  const drafts = await store.list();
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].id, 'a');
  assert.equal(drafts[0].text, 'Hello');
  assert.equal(typeof drafts[0].updatedAt, 'number');
});

test('empty list initially', async () => {
  const { store } = makeStore();
  assert.deepEqual(await store.list(), []);
});

test('same identifier: updated in place, not duplicated', async () => {
  const { store } = makeStore();
  await store.save('a', 'v1');
  await store.save('a', 'v2');
  const drafts = await store.list();
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].text, 'v2');
});

test('empty or blank text: deletes the existing draft', async () => {
  const { store } = makeStore();
  await store.save('a', 'Hello');
  await store.save('a', '   \n');
  assert.deepEqual(await store.list(), []);
});

test('empty text with an unknown identifier: nothing created', async () => {
  const { store } = makeStore();
  await store.save('a', '');
  assert.deepEqual(await store.list(), []);
});

test('list: most recent to oldest', async () => {
  const { store } = makeStore();
  await store.save('a', '1');
  await store.save('b', '2');
  await store.save('c', '3');
  assert.deepEqual((await store.list()).map(d => d.id), ['c', 'b', 'a']);
});

test('editing an old draft brings it to the top', async () => {
  const { store } = makeStore();
  await store.save('a', '1');
  await store.save('b', '2');
  await store.save('a', 'updated 1');
  assert.deepEqual((await store.list()).map(d => d.id), ['a', 'b']);
});

test('beyond max: the oldest drafts are deleted', async () => {
  const { store } = makeStore({ max: 3 });
  for (const id of ['a', 'b', 'c', 'd', 'e']) await store.save(id, 'text ' + id);
  assert.deepEqual((await store.list()).map(d => d.id), ['e', 'd', 'c']);
});

test('remove: deletes a draft, ignores an unknown identifier', async () => {
  const { store } = makeStore();
  await store.save('a', '1');
  await store.save('b', '2');
  await store.remove('a');
  await store.remove('unknown');
  assert.deepEqual((await store.list()).map(d => d.id), ['b']);
});

test('simultaneous saves: none are lost', async () => {
  const { store } = makeStore();
  await Promise.all(['a', 'b', 'c', 'd', 'e'].map(id => store.save(id, 'text ' + id)));
  assert.equal((await store.list()).length, 5);
});

test('an adapter error does not block subsequent operations', async () => {
  const adapter = memoryAdapter();
  let fail = true;
  const realSet = adapter.set;
  adapter.set = async (k, v) => { if (fail) throw new Error('quota'); return realSet(k, v); };
  const store = createStore(adapter, { now: () => 1 });
  await assert.rejects(store.save('a', 'x'), /quota/);
  fail = false;
  await store.save('b', 'y');
  assert.deepEqual((await store.list()).map(d => d.id), ['b']);
});

test('extra: additional fields preserved, identifier and text not overwritable', async () => {
  const { store } = makeStore();
  await store.save('a', 'text', { name: 'My template', id: 'pirate', text: 'pirate' });
  const [d] = await store.list();
  assert.equal(d.name, 'My template');
  assert.equal(d.id, 'a');
  assert.equal(d.text, 'text');
});

test('corrupted data in storage: treated as empty', async () => {
  const { store, adapter } = makeStore();
  adapter.data.drafts = 'not an array';
  assert.deepEqual(await store.list(), []);
});
