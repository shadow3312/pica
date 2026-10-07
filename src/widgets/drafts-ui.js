// @ts-check
/*
 * Local drafts, interface side: automatic saving of what is written in a
 * post, and a panel to restore a draft (LinkedIn regularly loses them).
 * The storage logic is in drafts.js; here we connect to chrome.storage.local
 * (the manifest's "storage" permission — nothing leaves the browser).
 *
 * Known limitations:
 * - Posts only (not comments or messages).
 * - A published post remains in the list until it is removed by the most recent ones (the
 *   limit is 20): the extension cannot detect publication.
 * - Restoring a draft moves it to the current editor (the old entry is removed).
 */
(function () {
  "use strict";
  const E = globalThis.LinkedInEditor;
  const D = globalThis.LinkedInDrafts;
  const L = globalThis.LinkedInLayout;
  const UI = globalThis.LinkedInUI;
  const ST = globalThis.LinkedInStorage;
  const adapter = ST && ST.adapter;
  if (!E || !D || !L || !UI || !ST || !adapter) return;

  const SAVE_DELAY = 1000;
  const PREVIEW_CHARS = 70;

  const store = D.createStore(adapter);
  const quiet = ST.quiet;
  const enabled = () => ST.settings.get("drafts");
  // A setting changes in the popup: there is no page event to refresh the display, so we request it.
  ST.settings.onChange((name) => {
    if (name === "drafts") E.requestUpdate();
  });

  // ---------- Automatic saving ----------
  /** @type {WeakMap<HTMLElement, string>} */
  const ids = new WeakMap();
  /**
   * @param {HTMLElement} editor
   * @returns {string}
   */
  function idFor(editor) {
    let id = ids.get(editor);
    if (!id) {
      id =
        "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      ids.set(editor, id);
    }
    return id;
  }

  let timer = 0;
  /** @type {HTMLElement | null} */
  let pendingEditor = null;
  function flush() {
    clearTimeout(timer);
    if (!pendingEditor) return;
    const editor = pendingEditor;
    pendingEditor = null;
    if (!enabled()) return;
    store.save(idFor(editor), E.getText(editor)).then(refresh, quiet);
  }

  E.on("input", () => {
    if (!enabled()) return;
    const ctx = E.currentContext();
    if (!ctx || ctx.field !== "post") return;
    pendingEditor = ctx.editor;
    clearTimeout(timer);
    timer = setTimeout(flush, SAVE_DELAY);
  });
  E.on("focusout", flush);
  E.on("hidden", flush);

  // ---------- UI: chip + panel (shadow DOM, like the toolbar) ----------
  const { shadow, setVisible } = UI.mount("drafts");
  const chip = UI.chip(1); // 2nd chip of the row, after « Templates » (templates-ui.js)
  shadow.innerHTML = `
    <style>
      * { font-family:-apple-system,system-ui,"Segoe UI",Roboto,sans-serif; box-sizing:border-box; }
      .chip { position:absolute; left:0; top:0; pointer-events:auto; cursor:pointer; user-select:none;
              font-size:11px; padding:2px 8px; border-radius:10px; background:#1d2226; color:#fff; }
      .chip:hover { background:#0a66c2; }
      .panel { position:absolute; left:0; top:0; width:300px; max-height:260px; overflow:auto; pointer-events:auto;
               background:#fff; color:#1d2226; border-radius:8px; box-shadow:0 4px 18px rgba(0,0,0,.3); padding:4px; }
      .item { display:flex; align-items:center; gap:6px; padding:6px 8px; border-radius:6px; cursor:pointer; font-size:12px; }
      .item:hover { background:#eef3f8; }
      .txt { flex:1; min-width:0; }
      .prev { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .when { font-size:10px; color:#666; }
      .del { border-radius:50%; width:20px; height:20px; text-align:center; line-height:20px; color:#666; }
      .del:hover { background:#dc3545; color:#fff; }
    </style>
    <div class="chip" style="display:none"></div>
    <div class="panel" style="display:none"></div>`;

  const chipEl = /** @type {HTMLElement} */ (shadow.querySelector(".chip"));
  const panelEl = /** @type {HTMLElement} */ (shadow.querySelector(".panel"));

  const rtf =
    typeof Intl !== "undefined" && Intl.RelativeTimeFormat
      ? new Intl.RelativeTimeFormat("fr", { numeric: "auto" })
      : null;
  /**
   * @param {number} ts
   * @returns {string}
   */
  function ago(ts) {
    const s = Math.round((ts - Date.now()) / 1000);
    if (!rtf) return new Date(ts).toLocaleString("fr");
    if (Math.abs(s) < 60) return rtf.format(s, "second");
    if (Math.abs(s) < 3600) return rtf.format(Math.round(s / 60), "minute");
    if (Math.abs(s) < 86400) return rtf.format(Math.round(s / 3600), "hour");
    return rtf.format(Math.round(s / 86400), "day");
  }

  /** @type {LF.Draft[]} */
  let drafts = [];
  /** @type {HTMLElement | null} */
  let currentEditor = null;
  let open = false;

  function refresh() {
    return store.list().then((all) => {
      const own = currentEditor ? idFor(currentEditor) : null;
      drafts = all.filter((d) => d.id !== own);
      update();
    }, quiet);
  }

  /** @param {LF.Draft} draft */
  function restore(draft) {
    if (!currentEditor) return;
    if (E.replaceAll(currentEditor, draft.text))
      store.remove(draft.id).then(refresh, quiet);
    open = false;
    update();
  }

  function renderPanel() {
    panelEl.textContent = "";
    for (const d of drafts) {
      const item = document.createElement("div");
      item.className = "item";
      const txt = document.createElement("div");
      txt.className = "txt";
      const prev = document.createElement("div");
      prev.className = "prev";
      prev.textContent = d.text
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, PREVIEW_CHARS);
      const when = document.createElement("div");
      when.className = "when";
      when.textContent = ago(d.updatedAt);
      txt.append(prev, when);
      const del = document.createElement("div");
      del.className = "del";
      del.textContent = "×";
      del.title = "Supprimer ce brouillon";
      del.dataset.id = d.id;
      item.append(txt, del);
      item.dataset.id = d.id;
      panelEl.append(item);
    }
  }

  // mousedown + preventDefault : clic does not blur the editor (LinkedIn's default behavior), so the draft is not lost.
  shadow.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const target = /** @type {Element} */ (e.target);
    if (target.closest(".chip")) {
      open = !open;
      update();
      return;
    }
    const del = /** @type {HTMLElement | null} */ (target.closest(".del"));
    if (del && del.dataset.id) {
      store.remove(del.dataset.id).then(refresh, quiet);
      return;
    }
    const item = /** @type {HTMLElement | null} */ (target.closest(".item"));
    // find() cannot find anything (draft deleted in the meantime, other tab) : do not crash.
    const draft = item && drafts.find((d) => d.id === item.dataset.id);
    if (draft) restore(draft);
  });

  function hide() {
    chip.set(false, 0);
    setVisible(false);
    open = false;
  }

  function update() {
    if (!enabled()) {
      currentEditor = null;
      return hide();
    }
    const ctx = E.currentContext();
    if (!ctx || ctx.field !== "post") {
      currentEditor = null;
      return hide();
    }
    if (ctx.editor !== currentEditor) {
      currentEditor = ctx.editor;
      open = false;
      refresh();
    }
    if (!drafts.length) return hide();
    const rect = ctx.editor.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return hide();
    setVisible(true);

    chipEl.style.display = "block";
    chipEl.textContent = "Brouillons (" + drafts.length + ")";
    chip.set(true, chipEl.offsetWidth);
    const x = Math.round(rect.left + chip.offset());
    const chipY = rect.bottom + 4;
    chipEl.style.transform = `translate(${x}px, ${Math.round(chipY)}px)`;

    if (open) {
      renderPanel();
      panelEl.style.display = "block";
      const h = panelEl.offsetHeight;
      const y = L.placePopover(chipY, chipEl.offsetHeight, h);
      panelEl.style.transform = `translate(${x}px, ${y}px)`;
    } else {
      panelEl.style.display = "none";
    }
  }

  // update() rereads the context itself : it can be called after an action that changed it.
  E.on("update", () => update());
})();
