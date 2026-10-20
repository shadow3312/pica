// @ts-check
/*
 * Script injecté sur linkedin.com : barre flottante + raccourcis clavier
 * dans tous les champs éditables (posts, commentaires, messages, "À propos"...).
 * Ne connaît ni le DOM de LinkedIn (voir editor.js) ni les transformations (voir features.js) :
 * se contente d'afficher les features et de les déclencher.
 */
(function () {
  "use strict";
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
  // Ordre d'affichage des boutons ; les libellés/raccourcis viennent de features.js.
  const SEP = "|";
  const TOOLBAR_LAYOUT = [
    "bold",
    "italic",
    "underline",
    "strike",
    "mono",
    SEP,
    "bullets",
    "numbered",
    SEP,
    "clear",
    SEP,
    "french-typography",
    "markdown-export",
    SEP,
    "air",
  ];

  /** @param {string} body */
  const svg = (body) =>
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    body +
    "</svg>";
  // Tracés repris de Lucide (lucide.dev, licence ISC), sauf « » et le logo Markdown.
  // Une feature absente d'ici s'affiche avec son libellé texte de features.js.
  /** @type {Record<string, string>} */
  const ICONS = {
    bold: svg(
      '<path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8"/>',
    ),
    italic: svg(
      '<path d="M19 4h-9"/><path d="M14 20H5"/><path d="M15 4 9 20"/>',
    ),
    underline: svg('<path d="M6 4v6a6 6 0 0 0 12 0V4"/><path d="M4 20h16"/>'),
    strike: svg(
      '<path d="M16 4H9a3 3 0 0 0-2.83 4"/><path d="M14 12a4 4 0 0 1 0 8H6"/><path d="M4 12h16"/>',
    ),
    mono: svg('<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>'),
    bullets: svg(
      '<path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/>',
    ),
    numbered: svg(
      '<path d="M10 6h11"/><path d="M10 12h11"/><path d="M10 18h11"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>',
    ),
    clear: svg(
      '<path d="M4 7V4h16v3"/><path d="M5 20h6"/><path d="M13 4 8 20"/><path d="m15 15 5 5"/><path d="m20 15-5 5"/>',
    ),
    "french-typography": svg(
      '<path d="m7 8-3.5 4L7 16"/><path d="m11 8-3.5 4 3.5 4"/><path d="m13 8 3.5 4-3.5 4"/><path d="m17 8 3.5 4-3.5 4"/>',
    ),
    "markdown-export": svg(
      '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M6 15V9l2.5 3L11 9v6"/><path d="M16 9v6"/><path d="m13.5 12.5 2.5 2.5 2.5-2.5"/>',
    ),
    air: svg(
      '<path d="M13 4v16"/><path d="M17 4v16"/><path d="M19 4H9.5a4.5 4.5 0 0 0 0 9H13"/>',
    ),
  };
  /** @type {Array<{ sep?: boolean, action?: string, label?: string, title?: string }>} */
  const BUTTONS = TOOLBAR_LAYOUT.map((id) => {
    if (id === SEP) return { sep: true };
    const feature = FT.get(id);
    if (!feature || !feature.toolbar)
      throw new Error(
        "[LinkedIn Formatter] TOOLBAR_LAYOUT : « " +
          id +
          " » n'est pas une feature avec bouton (voir features.js)",
      );
    return { action: id, ...feature.toolbar };
  });

  // Couche « top » : la barre passe au-dessus des autres widgets. Elle se place par transform sur
  // .bar (position absolue dans la zone plein écran du widget), non plus sur un hôte à part.
  const { shadow, setVisible } = UI.mount("toolbar", { layer: "top" });
  shadow.innerHTML = `
    <style>
      /* Pas de transform ici : le JS positionne .bar par transform. */
      .bar { position:absolute; left:0; top:0; pointer-events:auto; display:flex; align-items:center; gap:2px; padding:5px;
             border-radius:12px; border:1px solid rgba(255,255,255,.09);
             background:linear-gradient(180deg, rgba(42,46,54,.92), rgba(24,27,32,.94));
             -webkit-backdrop-filter:blur(14px) saturate(150%); backdrop-filter:blur(14px) saturate(150%);
             box-shadow:inset 0 1px 0 rgba(255,255,255,.07), 0 12px 32px rgba(0,0,0,.38), 0 2px 6px rgba(0,0,0,.22);
             font-family:-apple-system,system-ui,"Segoe UI",Roboto,sans-serif; animation:lf-in .14s ease-out; }
      @keyframes lf-in { from { opacity:0; } to { opacity:1; } }
      button { all:unset; box-sizing:border-box; display:inline-grid; place-items:center; min-width:32px; height:32px; padding:0 7px;
               border-radius:8px; color:rgba(255,255,255,.68); font-size:13px; font-weight:600; line-height:1; cursor:pointer; user-select:none;
               transition:background .12s, color .12s, transform .08s; }
      button:hover { background:rgba(255,255,255,.10); color:#fff; }
      button:active { background:rgba(255,255,255,.16); color:#fff; transform:scale(.92); }
      button:focus-visible { outline:2px solid #70b5f9; outline-offset:1px; }
      svg { width:18px; height:18px; display:block; }
      .sep { width:1px; height:20px; margin:0 4px; background:linear-gradient(transparent, rgba(255,255,255,.2), transparent); }
      @media (prefers-reduced-motion: reduce) { .bar { animation:none; } button { transition:none; } }
    </style>
    <div class="bar">${BUTTONS.map((b) =>
      b.sep
        ? '<span class="sep"></span>'
        : `<button type="button" data-action="${b.action}" title="${b.title}" aria-label="${b.title}">${ICONS[b.action || ""] || b.label}</button>`,
    ).join("")}
    </div>`;
  // Élément de notre propre balisage (innerHTML ci-dessus) : jamais absent.
  const bar = /** @type {HTMLElement} */ (shadow.querySelector(".bar"));

  // mousedown + preventDefault : le clic ne fait pas perdre la sélection dans l'éditeur
  bar.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const btn = /** @type {Element} */ (e.target).closest("button");
    if (btn instanceof HTMLElement && btn.dataset.action)
      run(btn.dataset.action);
  });

  function hideToolbar() {
    setVisible(false);
  }

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
    const pos = L.placeToolbar(
      rect,
      { width: bar.offsetWidth, height: bar.offsetHeight },
      { width: window.innerWidth },
    );
    bar.style.transform = `translate(${pos.left}px, ${pos.top}px)`;
  }

  E.on("update", (ctx) => positionToolbar(ctx));

  // ---------- Raccourcis clavier ----------
  window.addEventListener(
    "keydown",
    (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (!E.editorOfEvent(e)) return;

      const key = (e.key || "").toLowerCase();
      const feature = FT.list().find((f) => FT.matchesShortcut(f, e, key));
      if (!feature) return;
      e.preventDefault();
      e.stopPropagation();
      run(feature.id);
    },
    true,
  );
})();
