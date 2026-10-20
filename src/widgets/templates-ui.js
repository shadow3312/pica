// @ts-check
/*
 * Variable-based templates UI: a “Templates” chip below the post editor,
 * a panel for inserting a template (with a small form for its variables), creating one
 * from the editor text, or deleting one. Logic is in templates.js; storage uses
 * the drafts.js store (key “templates”, chrome.storage.local).
 *
 */
(function () {
  'use strict';
  const E = globalThis.LinkedInEditor;
  const D = globalThis.LinkedInDrafts;
  const T = globalThis.LinkedInTemplates;
  const L = globalThis.LinkedInLayout;
  const UI = globalThis.LinkedInUI;
  const ST = globalThis.LinkedInStorage;
  const PS = globalThis.LinkedInPanelState;
  const adapter = ST && ST.adapter;
  if (!E || !D || !T || !L || !UI || !ST || !PS || !adapter) return;

  const PREVIEW_CHARS = 60;
  const store = D.createStore(adapter, { key: 'templates', max: 100 });
  const quiet = ST.quiet;
  // Two separate settings: “templates” (the chip and its panel) and “typedVariables”
  // (replacement while typing). The value field for a variable typed in reuses this panel, so it
  // remains usable even when the “Templates” chip is hidden.
  ST.settings.onChange(name => { if (name === 'templates' || name === 'typedVariables') E.requestUpdate(); });

  /** @type {LF.Draft[]} */
  let templates = [];
  /** @type {HTMLElement | null} */
  let currentEditor = null;
  let state = PS.initial();      // Panel state (mode, current form, pending variable...)
  let replacing = false;         // Prevents reacting to our own insertions

  // ---------- Interface (shadow DOM, like the toolbar) ----------
  const { shadow, setVisible } = UI.mount('templates');
  const chip = UI.chip(0); // First chip in the row, before “Drafts” (drafts-ui.js)
  shadow.innerHTML = `
    <style>
      * { font-family:-apple-system,system-ui,"Segoe UI",Roboto,sans-serif; box-sizing:border-box; }
      .chip { position:absolute; left:0; top:0; pointer-events:auto; cursor:pointer; user-select:none;
              font-size:11px; padding:2px 8px; border-radius:10px; background:#1d2226; color:#fff; }
      .chip:hover, .chip.on { background:#0a66c2; }
      .panel { position:absolute; left:0; top:0; width:300px; max-height:300px; overflow:auto; pointer-events:auto;
               background:#fff; color:#1d2226; border-radius:8px; box-shadow:0 4px 18px rgba(0,0,0,.3); padding:6px; font-size:12px; }
      .item { display:flex; align-items:center; gap:6px; padding:6px 8px; border-radius:6px; cursor:pointer; }
      .item:hover { background:#eef3f8; }
      .txt { flex:1; min-width:0; }
      .name { font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .prev { font-size:10px; color:#666; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .del { border-radius:50%; width:20px; height:20px; text-align:center; line-height:20px; color:#666; cursor:pointer; }
      .del:hover { background:#dc3545; color:#fff; }
      .new { padding:6px 8px; margin-top:2px; border-top:1px solid #e0e0e0; color:#0a66c2; cursor:pointer; border-radius:0 0 6px 6px; }
      .new:hover { background:#eef3f8; }
      .empty { padding:8px; color:#666; }
      h4 { margin:2px 4px 6px; font-size:12px; }
      label { display:block; margin:6px 4px 2px; font-size:11px; color:#444; }
      input, textarea { width:calc(100% - 8px); margin:0 4px; padding:5px 6px; border:1px solid #bbb; border-radius:4px; font-size:12px; }
      textarea { resize:vertical; min-height:90px; margin-top:6px; }
      input:focus, textarea:focus { outline:2px solid #0a66c2; border-color:transparent; }
      .row { display:flex; gap:6px; justify-content:flex-end; margin:8px 4px 2px; }
      .btn { padding:4px 10px; border-radius:12px; cursor:pointer; border:1px solid #0a66c2; color:#0a66c2; }
      .btn.primary { background:#0a66c2; color:#fff; }
      .notice { margin:4px; padding:4px 6px; border-radius:4px; background:#fff3cd; color:#664d03; }
    </style>
    <div class="chip" style="display:none">Modèles</div>
    <div class="panel" style="display:none"></div>`;
  // Elements from our own markup (innerHTML above): never absent.
  const chipEl = /** @type {HTMLElement} */ (shadow.querySelector('.chip'));
  const panelEl = /** @type {HTMLElement} */ (shadow.querySelector('.panel'));

  /**
   * @param {string} tag
   * @param {string} [cls]
   * @param {string} [text]
   * @returns {HTMLElement}
   */
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  const oneLine = PS.oneLine;

  /**
  * Panel input field: exists only in the mode that created it (see render()).
   * @param {string} selector
   * @returns {HTMLInputElement | HTMLTextAreaElement | null}
   */
  function field(selector) {
    return /** @type {HTMLInputElement | HTMLTextAreaElement | null} */ (panelEl.querySelector(selector));
  }

  // ---------- Panel rendering (only when the state changes: never rebuild
  // while typing in a field, or the input would be lost) ----------
  function render() {
    panelEl.textContent = '';
    if (state.mode === 'closed') return;
    if (state.notice) panelEl.append(el('div', 'notice', state.notice));

    if (state.mode === 'list') {
      if (!templates.length) panelEl.append(el('div', 'empty', 'Aucun modèle. Écris un texte dans l’éditeur (avec des {{variables}}) puis enregistre-le.'));
      for (const t of templates) {
        const item = el('div', 'item');
        item.dataset.action = 'use';
        item.dataset.id = t.id;
        const txt = el('div', 'txt');
        txt.append(el('div', 'name', t.name || 'Sans nom'), el('div', 'prev', oneLine(t.text, PREVIEW_CHARS)));
        const del = el('div', 'del', '×');
        del.title = 'Supprimer ce modèle';
        del.dataset.action = 'del';
        del.dataset.id = t.id;
        item.append(txt, del);
        panelEl.append(item);
      }
      const create = el('div', 'new', '+ Nouveau modèle…');
      create.dataset.action = 'create';
      const add = el('div', 'new', '+ Enregistrer le texte actuel comme modèle');
      add.dataset.action = 'new';
      add.style.borderTop = 'none';
      panelEl.append(create, add);
    }

    const form = state.formTemplate;
    if (state.mode === 'form' && form) {
      panelEl.append(el('h4', '', form.name || 'Modèle'));
      for (const name of T.extractVariables(form.text)) {
        const label = el('label', '', name);
        const input = document.createElement('input');
        input.type = 'text';
        input.dataset.var = name;
        label.append(input);
        panelEl.append(label);
      }
      panelEl.append(buttons('Insérer', 'insert'));
    }

    if (state.mode === 'save') {
      panelEl.append(el('h4', '', 'Nom du modèle'));
      const input = document.createElement('input');
      input.type = 'text';
      input.dataset.field = 'name';
      input.value = currentEditor ? oneLine((E.getText(currentEditor).split('\n').find(l => l.trim()) || ''), 30) : '';
      panelEl.append(input);
      panelEl.append(buttons('Enregistrer', 'save'));
    }
    if (state.mode === 'create') {
      panelEl.append(el('h4', '', 'Nouveau modèle'));
      const name = document.createElement('input');
      name.type = 'text';
      name.placeholder = 'Nom du modèle';
      name.dataset.field = 'create-name';
      const body = document.createElement('textarea');
      body.placeholder = 'Texte du modèle, avec des {{variables}} — {{date}} et {{date_courte}} sont remplies automatiquement';
      body.dataset.field = 'create-text';
      panelEl.append(name, body, buttons('Enregistrer', 'create-ok'));
    }

    const asked = state.pending;
    if (state.mode === 'ask' && asked) {
      panelEl.append(el('h4', '', 'Valeur de {{' + asked.name + '}}'));
      const input = document.createElement('input');
      input.type = 'text';
      input.dataset.field = 'ask';
      input.value = state.lastValues[asked.name] || '';
      panelEl.append(input, buttons('Remplacer', 'ask-ok'));
    }
    focusPanelInput();
  }

  // Focus the panel's first input field, if it does not already have focus.
  function focusPanelInput() {
    const first = /** @type {HTMLInputElement | null} */ (panelEl.querySelector('input'));
    if (first && shadow.activeElement !== first) { first.focus(); first.select(); }
  }

  /**
   * @param {string} okLabel
   * @param {string} okAction
   * @returns {HTMLElement}
   */
  function buttons(okLabel, okAction) {
    const row = el('div', 'row');
    const cancel = el('div', 'btn', 'Annuler');
    cancel.dataset.action = 'cancel';
    const ok = el('div', 'btn primary', okLabel);
    ok.dataset.action = okAction;
    row.append(cancel, ok);
    return row;
  }

  // ---------- State machine: events in, effects out ----------
  /**
  * Apply an event: update the state, rebuild the panel if it changed, and execute effects.
  * Does not reposition (see dispatch): update() calls it itself to close the panel.
   * @param {LF.PanelEvent} event
   */
  function apply(event) {
    const before = state;
    const out = PS.reduce(state, event);
    state = out.state;
    if (state !== before) render();
    for (const effect of out.effects) perform(effect);
  }

  /** @param {LF.PanelEvent} event */
  function dispatch(event) {
    apply(event);
    update();
  }

  function newId() {
    return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  /** Reload the list of saved templates. */
  function refresh() {
    return store.list().then(all => {
      templates = all;
      if (state.mode === 'list') render();
      update();
    }, quiet);
  }

  /**
  * Execute the effects requested by the state machine. This is the only place where the panel
  * interacts with the editor, storage, and focus.
   * @param {LF.PanelEffect} effect
   */
  function perform(effect) {
    switch (effect.type) {
      case 'focus-editor':
        if (currentEditor && currentEditor.isConnected) currentEditor.focus();
        break;

      case 'refresh-list':
        refresh();
        break;

      // Opened while typing “}”: LinkedIn's editor regains focus after finishing
      // processing that keystroke (observed in the browser: document.activeElement became the editor again, and
      // subsequent typing went into the post). So restore focus to the field immediately afterward.
      case 'refocus-panel': {
        const refocus = () => { if (state.mode === 'ask') focusPanelInput(); };
        setTimeout(refocus, 0);
        setTimeout(refocus, 80);
        break;
      }

      case 'insert': {
        if (!currentEditor) break;
        const text = T.fill(effect.template.text, effect.values);
        const range = effect.at ? E.rangeFromOffsets(currentEditor, effect.at.start, effect.at.end) : null;
        E.insertText(currentEditor, range, text);
        break;
      }

      // Saving is asynchronous: closing and restoring focus are handled by a separate event
      // (“saved”), rather than a line buried in a callback.
      case 'save-template':
        store.save(newId(), effect.text, { name: effect.name }).then(() => {
          dispatch({ type: 'saved' });
          return refresh();
        }, quiet);
        break;

      // The variable's Range does not survive the focus change: locate it again by its text.
      case 'replace-typed': {
        if (!currentEditor) break;
        const found = E.findTextOffsets(currentEditor, effect.raw, effect.offset);
        if (found) replaceRange(currentEditor, E.rangeFromOffsets(currentEditor, found.start, found.end), effect.value);
        break;
      }
    }
  }

  // Replace part of the editor text (the typed {{variable}}) with its value.
  /**
   * @param {HTMLElement} editor
   * @param {Range} range
   * @param {string} value
   */
  function replaceRange(editor, range, value) {
    if (!range.startContainer.isConnected) return;
    replacing = true;
    try { E.insertText(editor, range, value); } finally { replacing = false; }
  }

  // ---------- User actions -> events ----------
  /**
   * @param {string | undefined} action  valeur de data-action de l'élément cliqué
   * @param {string} [id]
   */
  function act(action, id) {
    switch (action) {
      case 'chip': {
        const ctx = E.currentContext();
        return dispatch({ type: 'chip', selection: ctx ? E.offsetsOf(ctx.editor, ctx.range) : null });
      }
      case 'use': {
        const tpl = id ? templates.find(t => t.id === id) : undefined;
        if (!tpl) return;
        return dispatch({ type: 'use', template: tpl, variables: T.extractVariables(tpl.text) });
      }
      case 'del':
        if (id) void store.remove(id).then(refresh, quiet);
        return;
      case 'new': return dispatch({ type: 'new' });
      case 'create': return dispatch({ type: 'create' });
      case 'create-ok': {
        const name = field('input[data-field="create-name"]');
        const text = field('textarea[data-field="create-text"]');
        return dispatch({ type: 'create-submit', name: name ? name.value : '', text: text ? text.value : '' });
      }
      case 'save': {
        if (!currentEditor) return;
        const name = field('input[data-field="name"]');
        return dispatch({ type: 'save-submit', name: name ? name.value : '', text: E.getText(currentEditor) });
      }
      case 'insert': {
        /** @type {Record<string, string>} */
        const values = {};
        for (const input of /** @type {NodeListOf<HTMLInputElement>} */ (panelEl.querySelectorAll('input[data-var]'))) {
          if (input.dataset.var) values[input.dataset.var] = input.value;
        }
        return dispatch({ type: 'form-submit', values });
      }
      case 'ask-ok': {
        const input = field('input[data-field="ask"]');
        if (!input) return;
        return dispatch({ type: 'ask-submit', value: input.value });
      }
      case 'cancel': return dispatch({ type: 'close' });
    }
  }

  // mousedown + preventDefault: clicking does not lose the editor selection,
  // except on an input field, which must be able to receive focus.
  shadow.addEventListener('mousedown', e => {
    const origin = /** @type {Element} */ (e.target);
    if (origin.tagName === 'INPUT' || origin.tagName === 'TEXTAREA') return;
    e.preventDefault();
    const target = /** @type {HTMLElement | null} */ (origin.closest('[data-action]') || (origin.closest('.chip') && chipEl));
    if (!target) return;
    if (target === chipEl) return act('chip');
    act(target.dataset.action, target.dataset.id);
  });

  // Pressing Enter in a field submits the current step.
  /** @type {Record<string, string>} */
  const ENTER_ACTION = { form: 'insert', save: 'save', ask: 'ask-ok' };

  // Keystrokes in the panel must not trigger LinkedIn shortcuts.
  shadow.addEventListener('keydown', ev => {
    const e = /** @type {KeyboardEvent} */ (ev);
    const origin = /** @type {Element} */ (e.target);
    e.stopPropagation();
    if (e.key === 'Enter' && origin.tagName === 'INPUT') {
      e.preventDefault();
      if (state.mode === 'create') { const body = field('textarea'); if (body) body.focus(); } // Enter in the name field -> text field
      else if (ENTER_ACTION[state.mode]) act(ENTER_ACTION[state.mode]);
    } else if (e.key === 'Enter' && origin.tagName === 'TEXTAREA' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      act('create-ok');
    }
  });
  // Escape closes our panel first. Otherwise, LinkedIn interprets it as “close the compose
  // window” and opens “Save this post as a draft?” on top (observed in the browser): its handler ran
  // before ours. So listen on window during the capture phase, and also block the modal's “cancel” event.
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.mode !== 'closed') {
      e.preventDefault();
      e.stopImmediatePropagation();
      dispatch({ type: 'close' });
    }
  }, true);
  window.addEventListener('cancel', e => { if (state.mode !== 'closed') e.preventDefault(); }, true);

  shadow.addEventListener('keyup', e => e.stopPropagation());
  shadow.addEventListener('keypress', e => e.stopPropagation());

  // Returning focus to the editor closes an open form.
  E.on('focusin', e => {
    if (PS.isLocked(state) && E.editorOfEvent(e)) dispatch({ type: 'close' });
  });

  // ---------- Replacement while typing ----------
  E.on('input', e => {
    if (!ST.settings.get('typedVariables')) return;
    if (replacing || e.isComposing || e.inputType !== 'insertText' || e.data !== '}') return;
    const ctx = E.currentContext();
    if (!ctx || ctx.field !== 'post' || !ctx.range.collapsed) return;
    const node = ctx.range.startContainer;
    if (node.nodeType !== 3) return; // Plain text only
    const end = ctx.range.startOffset;
    const found = T.matchVariableAtEnd((node.nodeValue || '').slice(0, end));
    if (!found) return;
    const start = end - found.raw.length;
    const auto = T.fill(found.raw, {});          // Automatic variable: its value; otherwise unchanged
    if (auto !== found.raw) {
      // Replace immediately without changing focus: a fresh Range is sufficient.
      const range = document.createRange();
      range.setStart(node, start);
      range.setEnd(node, end);
      return replaceRange(ctx.editor, range, auto);
    }
    currentEditor = ctx.editor;                  // Variable to prompt for: show a small form
    dispatch({ type: 'ask-open', name: found.name, raw: found.raw, offset: E.textOffset(ctx.editor, node, start) });
  });

  // ---------- Positioning ----------
  function hide() { chip.set(false, 0); setVisible(false); }

  function update() {
    const ctx = E.currentContext();
    if (ctx && ctx.field === 'post') {
      if (ctx.editor !== currentEditor) { currentEditor = ctx.editor; apply({ type: 'reset' }); refresh(); }
    } else if (!PS.isLocked(state)) {
      currentEditor = null;
      apply({ type: 'reset' });
      return hide();
    }
    if (!currentEditor || !currentEditor.isConnected) { currentEditor = null; apply({ type: 'reset' }); return hide(); }

    // When the setting hides the chip, hide the template list panel too (the value field for a
    // variable typed in remains visible while it is open).
    const chipOn = ST.settings.get('templates');
    if (!chipOn) apply({ type: 'chip-disabled' });
    if (!chipOn && state.mode === 'closed') return hide();

    const rect = currentEditor.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return hide();
    setVisible(true);

    const chipY = rect.bottom + 4;
    chipEl.style.display = chipOn ? 'block' : 'none';
    chipEl.classList.toggle('on', state.mode !== 'closed');
    chip.set(chipOn, chipOn ? chipEl.offsetWidth : 0);
    const x = Math.round(rect.left + chip.offset());
    chipEl.style.transform = `translate(${x}px, ${Math.round(chipY)}px)`;

    if (state.mode === 'closed') { panelEl.style.display = 'none'; return; }
    panelEl.style.display = 'block';
    const y = L.placePopover(chipY, chipEl.offsetHeight, panelEl.offsetHeight);
    panelEl.style.transform = `translate(${x}px, ${y}px)`;
  }

  // update() reads the context again: it may be called after an action that changed it.
  E.on('update', () => update());
})();
