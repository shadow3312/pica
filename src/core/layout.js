// @ts-check
/*
 * Placement geometry engine (no DOM dependencies): where to place the toolbar and panels.
 * It is used by the DOM engine to compute the actual position of the elements.
 */
/** @param {typeof globalThis & { LinkedInLayout?: LF.Layout }} root */
(function (root) {
  "use strict";

  const EDGE = 8; // minimal distance from the edge of the viewport

  /**
   * Position of the floating toolbar: centered above the selection, or below if not enough space.
   * @param {{left: number, top: number, width: number, bottom: number}} anchor rectangle of selection
   * @param {{width: number, height: number}} size size of the element to place
   * @param {{width: number}} viewport size of the viewport
   * @returns {{left: number, top: number}} position of the element to place
   */
  function placeToolbar(anchor, size, viewport) {
    let top = anchor.top - size.height - EDGE;
    if (top < EDGE) top = anchor.bottom + EDGE;
    let left = anchor.left + (anchor.width - size.width) / 2;
    left = Math.max(EDGE, Math.min(left, viewport.width - size.width - EDGE));
    return { left: Math.round(left), top: Math.round(top) };
  }

  /**
   * Position of a popover panel: below the chip, or above if not enough space.
   * @param {number} chipTop top of the chip
   * @param {number} chipHeight height of the chip
   * @param {number} panelHeight height of the panel
   * @returns {number} top position of the panel
   */
  function placePopover(chipTop, chipHeight, panelHeight) {
    const gap = 4;
    const above = chipTop - panelHeight - gap;
    return Math.round(above >= EDGE ? above : chipTop + chipHeight + gap);
  }

  /**
   * Flows items in a row, returning their x-positions.
   * @param {Array<{width: number, visible: boolean}>} items
   * @param {number} gap
   * @returns {number[]}
   */
  function flowRow(items, gap) {
    let x = 0;
    return items.map((item) => {
      const at = x;
      if (item.visible) x += item.width + gap;
      return at;
    });
  }

  /** @type {LF.Layout} */
  const api = { placeToolbar, placePopover, flowRow };
  /** @type {{ LinkedInLayout?: LF.Layout }} */ (root).LinkedInLayout = api;

  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
