// @ts-check
/*
 * “Aérer” chip below the post editor, shown only when the text is a dense block
 * (LinkedInAiring.isDense): clicking it breaks up the entire post into blocks of 1–2 sentences, separated by blank lines.
 * Enabled in the popup (“airing” setting). The same operation is also available on demand
 * (“air” feature, Ctrl+Shift+K), whether or not the setting is enabled. Ctrl+Z undoes the change.
 *
 * Third chip in the row, after “Templates” (0) and “Drafts” (1).
 */
(function () {
  'use strict';
  const E = globalThis.LinkedInEditor;
  const UI = globalThis.LinkedInUI;
  const AI = globalThis.LinkedInAiring;
  const ST = globalThis.LinkedInStorage;

  const { shadow, setVisible } = UI.mount('airing');
  const chip = UI.chip(2);
  shadow.innerHTML = `
    <style>
      * { font-family:-apple-system,system-ui,"Segoe UI",Roboto,sans-serif; box-sizing:border-box; }
      .chip { position:absolute; left:0; top:0; pointer-events:auto; cursor:pointer; user-select:none;
              font-size:11px; padding:2px 8px; border-radius:10px; background:#1d2226; color:#fff; }
      .chip:hover { background:#0a66c2; }
    </style>
    <div class="chip" style="display:none" title="Découper en blocs de 1 à 2 phrases (Ctrl+Maj+K)">¶ Aérer</div>`;
  // Element from our own markup (innerHTML above): always present.
  const chipEl = /** @type {HTMLElement} */ (shadow.querySelector('.chip'));

  /** @type {HTMLElement | null} */
  let currentEditor = null;

  // isDense() processes the entire text, so rerun it only when the text changes.
  let lastText = '';
  let lastDense = false;
  /** @param {string} text */
  function dense(text) {
    if (text !== lastText) { lastText = text; lastDense = AI.isDense(text); }
    return lastDense;
  }

  // mousedown + preventDefault: clicking does not take focus away from the editor.
  shadow.addEventListener('mousedown', e => {
    e.preventDefault();
    if (!currentEditor) return;
    const text = E.getText(currentEditor);
    const aired = AI.airate(text);
    if (aired !== text.trim()) E.replaceAll(currentEditor, aired);
    E.requestUpdate();
  });

  function hide() { chip.set(false, 0); setVisible(false); }

  function update() {
    if (!ST.settings.get('airing')) { currentEditor = null; return hide(); }
    const ctx = E.currentContext();
    if (!ctx || ctx.field !== 'post') { currentEditor = null; return hide(); }
    currentEditor = ctx.editor;
    if (!dense(E.getText(ctx.editor))) return hide();
    const rect = ctx.editor.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return hide();

    setVisible(true);
    chipEl.style.display = 'block';
    chip.set(true, chipEl.offsetWidth);
    const x = Math.round(rect.left + chip.offset());
    chipEl.style.transform = `translate(${x}px, ${Math.round(rect.bottom + 4)}px)`;
  }

  ST.settings.onChange(name => { if (name === 'airing') E.requestUpdate(); });
  E.on('update', () => update());
})();
