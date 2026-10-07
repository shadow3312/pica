// @ts-check
/*
 * Shared interface host: a single element placed on the page (and, when the editor is in a
 * modal window, in that window), which carries all widgets (toolbar, counter,
 * drafts, templates).
 *
 * Each widget receives its own area covering the window (`position:absolute; inset:0`, without
 * capturing the mouse) with its own shadow DOM: its styles therefore do not conflict with
 * those of the others (`.chip`, `.panel`... exist in several widgets). Inside, a widget
 * positions itself as before, in window coordinates.
 */
/** @param {typeof globalThis} root */
(function (root) {
  'use strict';
  const E = root.LinkedInEditor;
  const L = root.LinkedInLayout;

  const CHIP_GAP = 6;

  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483646;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'closed' });
  (document.body || document.documentElement).appendChild(host);

  // A modal window (<dialog>) is in the top layer: only a descendant can pass above it.
  // The host is moved only when an editor is active; otherwise (e.g. a panel keeps the focus, so
  // no editor is active) it stays where it is. Subscribed first (loaded before the widgets): the host
  // is already in the correct place when the widgets update.
  E.on('update', ctx => {
    if (!ctx) return;
    const parent = E.overlayParent(ctx.editor);
    if (host.parentNode !== parent) parent.appendChild(host);
  });

  /**
   * Reserves an area for a widget.
   * @param {string} id
   * @param {{ layer?: 'base' | 'top' }} [options]  'top': above the other widgets (toolbar)
   * @returns {{ shadow: ShadowRoot, setVisible: (visible: boolean) => void }}
   */
  function mount(id, options) {
    const area = document.createElement('div');
    area.dataset.widget = id;
    area.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:none;z-index:' +
      (options && options.layer === 'top' ? '2' : '1');
    shadow.appendChild(area);
    return {
      shadow: area.attachShadow({ mode: 'closed' }),
      setVisible(visible) { area.style.display = visible ? 'block' : 'none'; },
    };
  }

  // ---------- Chip row ----------
  // The "Templates" and "Drafts" chips align side by side under the editor. Each says
  // whether it is visible and its width; the host calculates the offset of each one (layout.flowRow).
  // The order of widget updates is not guaranteed (it is the manifest's order): a chip can
  // read the offset before the previous one has declared its width. When a chip changes its
  // visibility or width, a new layout is requested; the offsets converge over additional renders,
  // and stop as soon as nothing changes.
  /** @type {Array<{ order: number, width: number, visible: boolean }>} */
  const chips = [];

  /**
   * @param {number} order  position in the row (0 = far left)
   * @returns {{ set: (visible: boolean, width: number) => void, offset: () => number }}
   */
  function chip(order) {
    const entry = { order, width: 0, visible: false };
    chips.push(entry);
    chips.sort((a, b) => a.order - b.order);
    return {
      set(visible, width) {
        if (entry.visible === visible && entry.width === width) return;
        entry.visible = visible;
        entry.width = width;
        E.requestUpdate();
      },
      offset() { return L.flowRow(chips, CHIP_GAP)[chips.indexOf(entry)]; },
    };
  }

  /** @type {LF.UI} */
  const api = { mount, chip };
  root.LinkedInUI = api;
})(globalThis);
