// @ts-check
/*
 * Non-intrusive displays on the active editor: contextual character counter and
 * cut line for « ...see more ». Never changes the text, only the display.
 *
 */
(function () {
  'use strict';
  const E = globalThis.LinkedInEditor;
  const UI = globalThis.LinkedInUI;

  /** @type {Partial<Record<LF.FieldType, number>>} */
  const COUNTER_LIMIT = { post: 3000, comment: 1250 };
  /** @type {Partial<Record<LF.FieldType, number>>} */
  const CUT_AT = { post: 210 };

  const { shadow, setVisible } = UI.mount('overlay');
  shadow.innerHTML = `
    <style>
      .cut { position:absolute; left:0; border-top:1px dashed rgba(220,53,69,.75); }
      .cut span { position:absolute; bottom:1px; right:0; font:10px -apple-system,system-ui,"Segoe UI",Roboto,sans-serif;
                  color:#dc3545; background:rgba(255,255,255,.8); padding:0 3px; white-space:nowrap; }
      .counter { position:absolute; font:11px -apple-system,system-ui,"Segoe UI",Roboto,sans-serif;
                 padding:2px 7px; border-radius:10px; background:#1d2226; color:#fff; white-space:nowrap; }
      .counter.over { background:#dc3545; }
    </style>
    <div class="cut" style="display:none"><span>« voir plus » ~</span></div>
    <div class="counter" style="display:none"></div>`;
    
  const cutEl = /** @type {HTMLElement} */ (shadow.querySelector('.cut'));
  const counterEl = /** @type {HTMLElement} */ (shadow.querySelector('.counter'));

  function hide() { setVisible(false); }

  /**
   * @param {HTMLElement} editor
   * @param {LF.FieldType} field
   * @param {DOMRect} rect
   */
  function updateCounter(editor, field, rect) {
    const limit = COUNTER_LIMIT[field];
    if (!limit) { counterEl.style.display = 'none'; return; }
    const n = E.textLength(editor);
    counterEl.style.display = 'block';
    counterEl.textContent = n + ' / ' + limit;
    counterEl.classList.toggle('over', n > limit);
    const x = rect.right - counterEl.offsetWidth;
    const y = rect.bottom + 4;
    counterEl.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  }

  /**
   * @param {HTMLElement} editor
   * @param {LF.FieldType} field
   * @param {DOMRect} rect
   */
  function updateCutLine(editor, field, rect) {
    const cutAt = CUT_AT[field];
    if (!cutAt) { cutEl.style.display = 'none'; return; }
    const r = E.rangeAtGraphemeOffset(editor, cutAt);
    if (!r) { cutEl.style.display = 'none'; return; } // shorter than cutAt
    const cr = r.getClientRects()[0] || r.getBoundingClientRect();
    if (!cr || (!cr.width && !cr.height)) { cutEl.style.display = 'none'; return; }
    cutEl.style.display = 'block';
    cutEl.style.width = Math.round(rect.width) + 'px';
    cutEl.style.transform = `translate(${Math.round(rect.left)}px, ${Math.round(cr.top)}px)`;
  }

  /**
   * Display only: does not modify either the editor or the focus, so the context of the
   * current image (provided by the bus) remains valid.
   * @param {LF.EditorContext | null} ctx
   */
  function update(ctx) {
    if (!ctx) return hide();
    const { editor, field } = ctx;
    const rect = editor.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return hide();
    setVisible(true);
    updateCounter(editor, field, rect);
    updateCutLine(editor, field, rect);
  }

  E.on('update', update);
})();
