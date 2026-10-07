const test = require('node:test');
const assert = require('node:assert/strict');
const PS = require('../src/core/panel-state.js');

const TPL = { id: 't1', name: 'Opening', text: 'Cohort {{cohorte}}', updatedAt: 1 };
const TPL_PLAIN = { id: 't2', name: 'Hello', text: 'Hello', updatedAt: 2 };
const SEL = { start: 3, end: 3 };

/** Replays a sequence of events; returns the final state and all effects in order. */
function run(events, from = PS.initial()) {
  let state = from;
  const effects = [];
  for (const event of events) {
    const out = PS.reduce(state, event);
    state = out.state;
    effects.push(...out.effects);
  }
  return { state, effects };
}
const types = effects => effects.map(e => e.type);

// Recursively freezes: any in-place mutation raises an error (strict mode).
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    Object.values(o).forEach(deepFreeze);
  }
  return o;
}

// ---------- Opening, closing ----------

test('initial state: closed, nothing pending', () => {
  const s = PS.initial();
  assert.equal(s.mode, 'closed');
  assert.equal(s.formTemplate, null);
  assert.equal(s.pending, null);
  assert.equal(s.notice, '');
  assert.equal(s.savedOffsets, null);
  assert.deepEqual(s.lastValues, {});
  assert.equal(PS.isLocked(s), false);
});

test('chip: opens the list, remembers the selection, requests the list to be reloaded', () => {
  const { state, effects } = run([{ type: 'chip', selection: SEL }]);
  assert.equal(state.mode, 'list');
  assert.deepEqual(state.savedOffsets, SEL);
  assert.deepEqual(types(effects), ['refresh-list']);
});

test('chip: without a known selection, keeps the previous one', () => {
  const opened = run([{ type: 'chip', selection: SEL }, { type: 'close' }]).state;
  const { state } = run([{ type: 'chip', selection: null }], opened);
  assert.deepEqual(state.savedOffsets, SEL);
});

test('chip: clears a message left from a previous opening', () => {
  const s = { ...PS.initial(), notice: 'old message' };
  assert.equal(run([{ type: 'chip', selection: null }], s).state.notice, '');
});

test('chip: on an open panel (any mode), closes and returns focus to the editor', () => {
  for (const events of [
    [{ type: 'chip', selection: SEL }],
    [{ type: 'chip', selection: SEL }, { type: 'new' }],
    [{ type: 'chip', selection: SEL }, { type: 'use', template: TPL, variables: ['cohorte'] }],
  ]) {
    const opened = run(events).state;
    const { state, effects } = run([{ type: 'chip', selection: SEL }], opened);
    assert.equal(state.mode, 'closed');
    assert.deepEqual(types(effects), ['focus-editor']);
  }
});

test('close: closes, resets everything, and returns focus (Esc, Cancel, back in the editor)', () => {
  const s = run([{ type: 'chip', selection: SEL }, { type: 'use', template: TPL, variables: ['cohorte'] }]).state;
  const { state, effects } = run([{ type: 'close' }], s);
  assert.equal(state.mode, 'closed');
  assert.equal(state.formTemplate, null);
  assert.equal(state.pending, null);
  assert.equal(state.notice, '');
  assert.deepEqual(types(effects), ['focus-editor']);
});

test('close on an already closed panel: no new state, but focus is returned', () => {
  const s = PS.initial();
  const out = PS.reduce(s, { type: 'close' });
  assert.equal(out.state, s);
  assert.deepEqual(types(out.effects), ['focus-editor']);
});

test('reset: SILENT closing (the editor changed or disappeared) — focus is never returned', () => {
  const s = run([{ type: 'chip', selection: SEL }, { type: 'new' }]).state;
  const { state, effects } = run([{ type: 'reset' }], s);
  assert.equal(state.mode, 'closed');
  assert.deepEqual(effects, []);
});

test('reset on an already closed panel: same object (no unnecessary reconstruction)', () => {
  const s = PS.initial();
  assert.equal(PS.reduce(s, { type: 'reset' }).state, s);
});

// ---------- Insert a model ----------

test('model without variables: inserted immediately, at the remembered selection, panel closed', () => {
  const { state, effects } = run([
    { type: 'chip', selection: SEL },
    { type: 'use', template: TPL_PLAIN, variables: [] },
  ]);
  assert.equal(state.mode, 'closed');
  assert.deepEqual(effects[1], { type: 'insert', template: TPL_PLAIN, values: {}, at: SEL });
});

test('model with variables: opens the form, does not modify the editor', () => {
  const { state, effects } = run([
    { type: 'chip', selection: SEL },
    { type: 'use', template: TPL, variables: ['cohorte'] },
  ]);
  assert.equal(state.mode, 'form');
  assert.equal(state.formTemplate, TPL);
  assert.equal(PS.isLocked(state), true);
  assert.deepEqual(types(effects), ['refresh-list']);
});

test('form submitted: inserts the values, at the original selection, then closes', () => {
  const { state, effects } = run([
    { type: 'chip', selection: SEL },
    { type: 'use', template: TPL, variables: ['cohorte'] },
    { type: 'form-submit', values: { cohorte: 'C4' } },
  ]);
  assert.equal(state.mode, 'closed');
  assert.equal(state.formTemplate, null);
  assert.deepEqual(effects[effects.length - 1], { type: 'insert', template: TPL, values: { cohorte: 'C4' }, at: SEL });
});

test('submitted form without a model in progress: no effect', () => {
  const s = PS.initial();
  const out = PS.reduce(s, { type: 'form-submit', values: {} });
  assert.equal(out.state, s);
  assert.deepEqual(out.effects, []);
});

// ---------- Save a model ----------

test('« Save the current text »: save mode, locked', () => {
  const { state } = run([{ type: 'chip', selection: SEL }, { type: 'new' }]);
  assert.equal(state.mode, 'save');
  assert.equal(PS.isLocked(state), true);
});

test('save-submit: requests saving, without closing until it is done', () => {
  const opened = run([{ type: 'chip', selection: SEL }, { type: 'new' }]).state;
  const { state, effects } = run([{ type: 'save-submit', name: '  My model ', text: 'Text' }], opened);
  assert.equal(state.mode, 'save');
  assert.deepEqual(effects, [{ type: 'save-template', name: 'My model', text: 'Text' }]);
});

test('save-submit without a name: « Sans nom »', () => {
  const opened = run([{ type: 'chip', selection: SEL }, { type: 'new' }]).state;
  assert.deepEqual(run([{ type: 'save-submit', name: '   ', text: 'Text' }], opened).effects,
    [{ type: 'save-template', name: 'Sans nom', text: 'Text' }]);
});

test('save-submit with an empty editor: returns to the list with a message, nothing is saved', () => {
  const opened = run([{ type: 'chip', selection: SEL }, { type: 'new' }]).state;
  const { state, effects } = run([{ type: 'save-submit', name: 'x', text: '  \n ' }], opened);
  assert.equal(state.mode, 'list');
  assert.match(state.notice, /Écris d’abord le texte du modèle dans l’éditeur./);
  assert.ok(!types(effects).includes('save-template'));
});

test('REGRESSION — empty editor: focus is returned to the editor; otherwise, the interface closes', () => {
  // The name field that had focus disappears with save mode; list mode is not
  // locked (it requires an active editor). Without focus-editor, the message was never visible.
  const opened = run([{ type: 'chip', selection: SEL }, { type: 'new' }]).state;
  assert.equal(PS.isLocked(opened), true);
  const { state, effects } = run([{ type: 'save-submit', name: 'x', text: '' }], opened);
  assert.equal(PS.isLocked(state), false);
  assert.deepEqual(effects, [{ type: 'focus-editor' }]);
});

test('PROPERTY — any exit from a locked mode to a non-locked mode returns focus to the editor', () => {
  // General rule behind focus bugs: a field from the panel that disappears takes focus with it.
  const events = [
    { type: 'chip', selection: SEL }, { type: 'use', template: TPL, variables: ['a'] },
    { type: 'use', template: TPL_PLAIN, variables: [] }, { type: 'new' }, { type: 'create' },
    { type: 'create-submit', name: 'n', text: 't' }, { type: 'save-submit', name: 'n', text: '' },
    { type: 'save-submit', name: 'n', text: 'texte' }, { type: 'saved' }, { type: 'form-submit', values: {} },
    { type: 'ask-open', name: 'x', raw: '{{x}}', offset: 0 }, { type: 'ask-submit', value: 'v' },
    { type: 'close' }, { type: 'chip-disabled' },
  ];
  const seen = new Set();
  let frontier = [PS.initial()];
  for (let depth = 0; depth < 4; depth++) {
    const next = [];
    for (const state of frontier) {
      for (const event of events) {
        const out = PS.reduce(state, event);
        if (PS.isLocked(state) && !PS.isLocked(out.state) && out.state !== state) {
          const fx = types(out.effects);
          const ok = fx.includes('focus-editor') || fx.includes('insert') || fx.includes('replace-typed');
          assert.ok(ok, `${state.mode} -> ${out.state.mode} on « ${event.type} » without returning focus`);
        }
        const key = JSON.stringify(out.state);
        if (!seen.has(key)) { seen.add(key); next.push(out.state); }
      }
    }
    frontier = next;
  }
});

test('REGRESSION — once the model is saved: closes AND returns focus to the editor', () => {
  // Bug seen in the browser: after pressing Enter on the name, the field disappeared with the focus
  // and the entire panel closed because focus was not returned to the editor.
  const { state, effects } = run([
    { type: 'chip', selection: SEL },
    { type: 'new' },
    { type: 'save-submit', name: 'N', text: 'T' },
    { type: 'saved' },
  ]);
  assert.equal(state.mode, 'closed');
  assert.deepEqual(effects.slice(-1), [{ type: 'focus-editor' }]);
});

test('creation: empty text ignored (the panel remains open)', () => {
  const opened = run([{ type: 'chip', selection: SEL }, { type: 'create' }]).state;
  assert.equal(opened.mode, 'create');
  const out = PS.reduce(opened, { type: 'create-submit', name: 'N', text: '   ' });
  assert.equal(out.state, opened);
  assert.deepEqual(out.effects, []);
});

test('creation: without a name, the name is the beginning of the text (30 characters, on one line)', () => {
  const opened = run([{ type: 'chip', selection: SEL }, { type: 'create' }]).state;
  const text = 'Opening the cohort {{cohorte}}\nRegistrations open on {{date}} for everyone';
  const [effect] = run([{ type: 'create-submit', name: '', text }], opened).effects;
  assert.equal(effect.type, 'save-template');
  assert.equal(effect.name, 'Opening the cohort {{cohorte}}');
  assert.equal(effect.name.length, 30);
  assert.equal(effect.text, text, 'the model text is preserved exactly, including line breaks');
});

test('REGRESSION — saved creation: closes and returns focus', () => {
  const { state, effects } = run([
    { type: 'chip', selection: SEL },
    { type: 'create' },
    { type: 'create-submit', name: 'N', text: 'T' },
    { type: 'saved' },
  ]);
  assert.equal(state.mode, 'closed');
  assert.deepEqual(effects.slice(-1), [{ type: 'focus-editor' }]);
});

// ---------- Typed variable in the editor ----------

test('typed variable: opens the value field and requests it to be refocused', () => {
  // The LinkedIn editor resumes focus after finishing processing the keystroke: without this second focus,
  // what is typed next goes into the post (bug seen in the browser).
  const { state, effects } = run([{ type: 'ask-open', name: 'cohorte', raw: '{{cohorte}}', offset: 6 }]);
  assert.equal(state.mode, 'ask');
  assert.deepEqual(state.pending, { name: 'cohorte', raw: '{{cohorte}}', offset: 6 });
  assert.equal(PS.isLocked(state), true);
  assert.deepEqual(effects, [{ type: 'refocus-panel' }]);
});

test('validated value: replaces the variable found with its text and position, then closes', () => {
  const { state, effects } = run([
    { type: 'ask-open', name: 'cohorte', raw: '{{cohorte}}', offset: 6 },
    { type: 'ask-submit', value: 'C9' },
  ]);
  assert.equal(state.mode, 'closed');
  assert.equal(state.pending, null);
  assert.deepEqual(effects[1], { type: 'replace-typed', raw: '{{cohorte}}', offset: 6, value: 'C9' });
});

test('value remembered by variable, to prefill the next time', () => {
  const { state } = run([
    { type: 'ask-open', name: 'cohorte', raw: '{{cohorte}}', offset: 0 },
    { type: 'ask-submit', value: 'C9' },
    { type: 'ask-open', name: 'lieu', raw: '{{lieu}}', offset: 5 },
    { type: 'ask-submit', value: 'Paris' },
  ]);
  assert.deepEqual(state.lastValues, { cohorte: 'C9', lieu: 'Paris' });
});

test('empty value: accepted (the variable is simply removed)', () => {
  const { effects } = run([
    { type: 'ask-open', name: 'x', raw: '{{x}}', offset: 0 },
    { type: 'ask-submit', value: '' },
  ]);
  assert.deepEqual(effects[1], { type: 'replace-typed', raw: '{{x}}', offset: 0, value: '' });
});

test('validated value without a pending variable: no effect', () => {
  const s = PS.initial();
  const out = PS.reduce(s, { type: 'ask-submit', value: 'x' });
  assert.equal(out.state, s);
  assert.deepEqual(out.effects, []);
});

test('Esc on the value field: the {{variable}} text remains unchanged, focus returns', () => {
  const { state, effects } = run([
    { type: 'ask-open', name: 'x', raw: '{{x}}', offset: 0 },
    { type: 'close' },
  ]);
  assert.equal(state.mode, 'closed');
  assert.equal(state.pending, null);
  assert.deepEqual(effects.slice(-1), [{ type: 'focus-editor' }]);
  assert.ok(!types(effects).includes('replace-typed'));
});

test('a variable typed while the list is open takes the place of the list', () => {
  const { state } = run([
    { type: 'chip', selection: SEL },
    { type: 'ask-open', name: 'x', raw: '{{x}}', offset: 0 },
  ]);
  assert.equal(state.mode, 'ask');
});

// ---------- « Models » setting disabled ----------

test('setting disabled: the list closes without stealing focus', () => {
  const opened = run([{ type: 'chip', selection: SEL }]).state;
  const { state, effects } = run([{ type: 'chip-disabled' }], opened);
  assert.equal(state.mode, 'closed');
  assert.deepEqual(effects, []);
});

test('setting disabled: the value field of a typed variable remains open', () => {
  const asking = run([{ type: 'ask-open', name: 'x', raw: '{{x}}', offset: 0 }]).state;
  const out = PS.reduce(asking, { type: 'chip-disabled' });
  assert.equal(out.state, asking);
  assert.equal(out.state.mode, 'ask');
});

test('setting disabled while a model form is open: it remains open', () => {
  const form = run([{ type: 'chip', selection: SEL }, { type: 'use', template: TPL, variables: ['cohorte'] }]).state;
  assert.equal(PS.reduce(form, { type: 'chip-disabled' }).state, form);
});

// ---------- General properties ----------

test('the machine never modifies the received state (frozen state, all events)', () => {
  const base = run([
    { type: 'chip', selection: SEL },
    { type: 'use', template: TPL, variables: ['cohorte'] },
  ]).state;
  const events = [
    { type: 'chip', selection: SEL }, { type: 'use', template: TPL, variables: [] },
    { type: 'new' }, { type: 'create' }, { type: 'create-submit', name: 'n', text: 't' },
    { type: 'save-submit', name: 'n', text: 't' }, { type: 'saved' },
    { type: 'form-submit', values: { a: 'b' } }, { type: 'ask-open', name: 'x', raw: '{{x}}', offset: 1 },
    { type: 'ask-submit', value: 'v' }, { type: 'close' }, { type: 'reset' }, { type: 'chip-disabled' },
  ];
  for (const event of events) {
    assert.doesNotThrow(() => PS.reduce(deepFreeze(structuredClone(base)), deepFreeze(structuredClone(event))), event.type);
  }
});

test('every reachable state has a valid mode, and « locked » exactly follows form/save/create/ask', () => {
  const modes = ['closed', 'list', 'form', 'save', 'create', 'ask'];
  const events = [
    { type: 'chip', selection: SEL }, { type: 'use', template: TPL, variables: ['a'] },
    { type: 'use', template: TPL_PLAIN, variables: [] }, { type: 'new' }, { type: 'create' },
    { type: 'create-submit', name: 'n', text: 't' }, { type: 'save-submit', name: 'n', text: '' },
    { type: 'saved' }, { type: 'form-submit', values: {} }, { type: 'ask-open', name: 'x', raw: '{{x}}', offset: 0 },
    { type: 'ask-submit', value: 'v' }, { type: 'close' }, { type: 'reset' }, { type: 'chip-disabled' },
  ];
  // Breadth-first traversal of all reachable states (bounded), from the initial state.
  const seen = new Set();
  let frontier = [PS.initial()];
  for (let depth = 0; depth < 4; depth++) {
    const next = [];
    for (const state of frontier) {
      for (const event of events) {
        const out = PS.reduce(state, event);
        assert.ok(modes.includes(out.state.mode), `invalid mode after ${event.type}`);
        assert.equal(PS.isLocked(out.state), ['form', 'save', 'create', 'ask'].includes(out.state.mode));
        // Consistency: no residue from an old mode.
        if (out.state.mode !== 'form') assert.equal(out.state.formTemplate, null, `residual formTemplate after ${event.type}`);
        if (out.state.mode !== 'ask') assert.equal(out.state.pending, null, `residual pending after ${event.type}`);
        const key = JSON.stringify(out.state);
        if (!seen.has(key)) { seen.add(key); next.push(out.state); }
      }
    }
    frontier = next;
  }
  assert.ok(seen.size > 5, 'the traversal must explore several states');
});

test('effects only contain known types', () => {
  const known = ['focus-editor', 'refresh-list', 'refocus-panel', 'insert', 'save-template', 'replace-typed'];
  const events = [
    { type: 'chip', selection: SEL }, { type: 'use', template: TPL_PLAIN, variables: [] },
    { type: 'create-submit', name: 'n', text: 't' }, { type: 'ask-open', name: 'x', raw: '{{x}}', offset: 0 },
    { type: 'saved' }, { type: 'close' },
  ];
  for (const e of events) for (const fx of PS.reduce(PS.initial(), e).effects) assert.ok(known.includes(fx.type), fx.type);
});

test('unknown event: explicit error', () => {
    assert.throws(() => PS.reduce(PS.initial(), { type: 'nimportequoi' }), /Événement inconnu/);
});

test('oneLine: spaces reduced, truncated', () => {
  assert.equal(PS.oneLine('  a \n\n b\t c  ', 50), 'a b c');
  assert.equal(PS.oneLine('abcdef', 3), 'abc');
});
