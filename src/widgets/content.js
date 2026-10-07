// @ts-check
/*
 * Script injecté sur linkedin.com : barre flottante + raccourcis clavier
 * dans tous les champs éditables (posts, commentaires, messages, "À propos"...).
 * Ne connaît ni le DOM de LinkedIn (voir editor.js) ni les transformations
 * se contente d'afficher les features et de les déclencher.
 */
(function () {
  'use strict';
  const E = globalThis.LinkedInEditor;
  const FT = globalThis.LinkedInFeatures;
  const L = globalThis.LinkedInLayout;
  const UI = globalThis.LinkedInUI;

  /**
   * @param {string} id
   * @returns {boolean}
   */
  function run(id) {
    let ctx = E.currentContext();
    if (!ctx) return false;
    const feature = FT.get(id);
    if (!feature) return false;
    if (ctx.range.collapsed && feature.wholeText) {
      const all = E.getText(ctx.editor);
      const aired = feature.run(all);
      if (aired !== all.trim()) E.replaceAll(ctx.editor, aired);
      return true;
    }
    if (ctx.range.collapsed) {
      if (!feature.line) return false;
      E.selectCurrentLine(ctx.sel);
      ctx = E.currentContext();
      if (!ctx || ctx.range.collapsed) return false;
    }
    const original = E.rangeToText(ctx.range);
    const result = feature.run(original);
    if (result !== original) E.replaceSelection(ctx, result);
    positionToolbar();
    return true;
  }

  // ---------- Barre flottante (isolée dans un shadow DOM pour ne pas subir le CSS de LinkedIn) ----------
  const SEP = '|';
  const TOOLBAR_LAYOUT = ['bold', 'italic', 'underline', 'strike', 'mono', SEP, 'bullets', 'numbered', SEP, 'clear', SEP, 'french-typography', 'markdown-export', SEP, 'air'];
  /** @type {Array<{ sep?: boolean, action?: string, label?: string, title?: string }>} */
  const BUTTONS = TOOLBAR_LAYOUT.map(id => {
    if (id === SEP) return { sep: true };
    const feature = FT.get(id);
    if (!feature || !feature.toolbar) throw new Error('[LinkedIn Formatter] TOOLBAR_LAYOUT : « ' + id + ' » n\'est pas une feature avec bouton (voir features.js)');
    return { action: id, ...feature.toolbar };
  });

  // Couche top : la barre passe au-dessus des autres widgets. Elle se place par transform sur
  // .bar (position absolue dans la zone plein écran du widget).
  const { shadow, setVisible } = UI.mount('toolbar', { layer: 'top' });
  shadow.innerHTML = `
    <style>
      .bar { position:absolute; left:0; top:0; pointer-events:auto; display:flex; align-items:center; gap:2px; padding:4px; background:#1d2226; border-radius:8px;
             box-shadow:0 4px 14px rgba(0,0,0,.25); font-family:-apple-system,system-ui,"Segoe UI",Roboto,sans-serif; }
      button { all:unset; box-sizing:border-box; min-width:30px; height:30px; padding:0 6px; border-radius:6px;
               color:#fff; font-size:15px; line-height:30px; text-align:center; cursor:pointer; user-select:none; }
      button:hover { background:#0a66c2; }
      .sep { width:1px; height:18px; background:rgba(255,255,255,.2); margin:0 3px; }
    </style>
    <div class="bar">${BUTTONS.map(b => b.sep
      ? '<span class="sep"></span>'
      : `<button type="button" data-action="${b.action}" title="${b.title}" aria-label="${b.title}">${b.label}</button>`).join('')}
    </div>`;
  // Élément de notre propre balisage (innerHTML ci-dessus) : jamais absent.
  const bar = /** @type {HTMLElement} */ (shadow.querySelector('.bar'));

  // mousedown + preventDefault : le clic ne fait pas perdre la sélection dans l'éditeur
  bar.addEventListener('mousedown', e => {
    e.preventDefault();
    const btn = /** @type {Element} */ (e.target).closest('button');
    if (btn instanceof HTMLElement && btn.dataset.action) run(btn.dataset.action);
  });


  function hideToolbar() { setVisible(false); }

  /**
   * @param {LF.EditorContext | null} [ctx]  contexte de l'image en cours ; recalculé si omis
   *   (après une action, la sélection a changé et celui de l'image précédente est périmé)
   */
  function positionToolbar(ctx = E.currentContext()) {
    if (!ctx || ctx.range.collapsed) return hideToolbar();
    const rects = ctx.range.getClientRects();
    const rect = rects.length ? rects[0] : ctx.range.getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return hideToolbar();
    setVisible(true); // avant de mesurer : une zone masquée n'a pas de taille
    const pos = L.placeToolbar(rect, { width: bar.offsetWidth, height: bar.offsetHeight }, { width: window.innerWidth });
    bar.style.transform = `translate(${pos.left}px, ${pos.top}px)`;
  }

  E.on('update', ctx => positionToolbar(ctx));

  // ---------- Raccourcis clavier ----------
  window.addEventListener('keydown', e => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    if (!E.editorOfEvent(e)) return;

    const key = (e.key || '').toLowerCase();
    const feature = FT.list().find(f => FT.matchesShortcut(f, e, key));
    if (!feature) return;
    e.preventDefault();
    e.stopPropagation();
    run(feature.id);
  }, true);
})();
