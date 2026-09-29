// @ts-check
/*
 * Editor adapter: the only file that knows LinkedIn's DOM.
 * Find the active editor, read the selection, guess the type of field
 * Exposed on globalThis.LinkedInEditor
 */

(function (root) {
  "use strict";

  const EDITABLE =
    '[contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]';

  // ---------- Selection (including shadow DOM used by LinkedIn) ----------
  /** @returns {Element | null} */
  function deepActiveElement() {
    let el = document.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement)
      el = el.shadowRoot.activeElement;
    return el;
  }

  /** @returns {Selection | null} */
  function getSelectionObj() {
    const el = deepActiveElement();
    const rootNode = el && el.getRootNode ? el.getRootNode() : null;
    // ShadowRoot.getSelection() only exists in Chrome.
    const shadow =
      /** @type {(ShadowRoot & { getSelection?: () => Selection | null }) | null} */ (
        rootNode instanceof ShadowRoot ? rootNode : null
      );
    if (shadow && typeof shadow.getSelection === "function")
      return shadow.getSelection();
    return window.getSelection();
  }

  /**
   * @param {Node | null} node
   * @returns {HTMLElement | null}
   */
  function editorOf(node) {
    if (!node) return null;
    const el = /** @type {Element | null} */ (
      node.nodeType === 1 ? node : node.parentElement
    );
    return /** @type {HTMLElement | null} */ (el ? el.closest(EDITABLE) : null);
  }

  /**
   * Editor targeted by an event (ex. keydown), or null
   * @param {Event} e
   * @returns {HTMLElement | null}
   */
  function editorOfEvent(e) {
    const target = e.composedPath()[0];
    return target instanceof Element
      ? /** @type {HTMLElement | null} */ (target.closest(EDITABLE))
      : null;
  }

  /** @returns {LF.EditorContext | null} */
  function currentContext() {
    const sel = getSelectionObj();
    if (!sel || !sel.rangeCount) return null;
    const editor = editorOf(sel.anchorNode);
    if (!editor || editor !== editorOf(sel.focusNode)) return null;
    return { sel, editor, range: sel.getRangeAt(0), field: fieldType(editor) };
  }

  //   #region Type of field
  // Heuristic based on LinkedIn's DOM/URL; may change if LinkedIn changes.
  // 'post' | 'comment' | 'message' | 'other'

  /**
   * @param {HTMLElement | null} editor
   * @returns {LF.FieldType}
   */
  function fieldType(editor) {
    if (!editor || !editor.closest) return "other";
    if (editor.getAttribute("componentkey") === "ShareBox_textEditor")
      return "post";
    // CSS classes are hashed (unstable): rely on the aria-label, which depends on the UI language.
    if (/commentaire|comment/i.test(editor.getAttribute("aria-label") || ""))
      return "comment";
    if (editor.closest('[class*="msg-"], [class*="messaging"]'))
      return "message"; // Verified: class msg-form__contenteditable, in a shadow DOM.
    if (/^\/sharing\//.test(location.pathname)) return "post";
    return "other";
  }

  //   #endregion

  // #region Writing
  // Replace the selection via insertText: LinkedIn receives the native events (beforeinput/input).
  /**
   * @param {{ editor: HTMLElement, sel: Selection }} ctx
   * @param {string} newText
   */
  function replaceSelection(ctx, newText) {
    ctx.editor.focus();
    let ok = false;
    try {
      ok = document.execCommand("insertText", false, newText);
    } catch (_) {
      ok = false;
    }
    if (!ok) {
      const r = ctx.sel.getRangeAt(0);
      r.deleteContents();
      const node = document.createTextNode(newText);
      r.insertNode(node);
      r.setStartAfter(node);
      r.collapse(true);
      ctx.sel.removeAllRanges();
      ctx.sel.addRange(r);
      ctx.editor.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: newText,
        }),
      );
    }
    // Reselect the inserted text to allow chaining (e.g. Bold then Italic).
    try {
      const sel = getSelectionObj();
      if (!sel) return;
      const n = graphemeCount(newText);
      for (let i = 0; i < n; i++) sel.modify("extend", "backward", "character");
    } catch (_) {
      /* Optional reselection. */
    }
  }

  /**
  * Replace the editor's entire content (the same native mechanism as replaceSelection).
   * @param {HTMLElement} editor
   * @param {string} text
   * @returns {boolean}
   */
  function replaceAll(editor, text) {
    editor.focus();
    const sel = getSelectionObj();
    if (!sel) return false;
    const r = document.createRange();
    r.selectNodeContents(editor);
    sel.removeAllRanges();
    sel.addRange(r);
    let ok = false;
    try {
      ok = document.execCommand("insertText", false, text);
    } catch (_) {
      ok = false;
    }
    return ok;
  }

  //   #endregion

  // #region Reading
  // Serialize the selection: one line break per paragraph, including <br>.
  const BLOCKS = new Set([
    "P",
    "DIV",
    "LI",
    "UL",
    "OL",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "BLOCKQUOTE",
    "PRE",
  ]);
  /**
   * @param {Range} range
   * @returns {string}
   */
  function rangeToText(range) {
    let out = "";
    /** @param {Node} node */ (function walk(node) {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) out += child.nodeValue;
        else if (child.nodeType === 1) {
          const el = /** @type {Element} */ (child);
          if (el.tagName === "BR") {
            out += "\n";
            continue;
          }
          if (BLOCKS.has(el.tagName) && out && !out.endsWith("\n")) out += "\n";
          walk(el);
        }
      }
    })(range.cloneContents());
    return out;
  }

  /**
   * @param {string} str
   * @returns {number}
   */
  function graphemeCount(str) {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      return [
        ...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(
          str,
        ),
      ].length;
    }
    return [...str].length;
  }

  /**
   * Complete text of the editor, with one line break per paragraph.
   * @param {HTMLElement} editor
   * @returns {string}
   */
  function getText(editor) {
    const r = document.createRange();
    r.selectNodeContents(editor);
    return rangeToText(r);
  }

  /**
   * Length (in graphemes) of the editor's complete text, for character counting.
   * @param {HTMLElement} editor
   * @returns {number}
   */
  function textLength(editor) {
    const text = getText(editor);
    // An empty editor contains a paragraph ending with a <br>: this is not an entered character.
    // (Do not fix this in rangeToText: it is used to preserve empty lines between paragraphs.)
    return text === "\n" ? 0 : graphemeCount(text);
  }

  // UTF-16 index of the n-th grapheme in a string (to place a cursor/Range).
  /**
   * @param {string} str
   * @param {number} n
   * @returns {number}
   */
  function graphemeIndex(str, n) {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      let i = 0;
      for (const seg of new Intl.Segmenter(undefined, {
        granularity: "grapheme",
      }).segment(str)) {
        if (i === n) return seg.index;
        i++;
      }
      return str.length;
    }
    return [...str].slice(0, n).join("").length; // Approximation without Intl.Segmenter.
  }

  /**
   * Collapsed range just after the n-th grapheme of the editor text, or null if the
   * text contains fewer than n graphemes. Ignores line breaks between blocks (<p>, <div>):
   * sufficient approximation for a visual cut line, not for an exact counter.
   * @param {HTMLElement} editor
   * @param {number} n
   * @returns {Range | null}
   */
  function rangeAtGraphemeOffset(editor, n) {
    if (n <= 0) {
      const r = document.createRange();
      r.setStart(editor, 0);
      r.collapse(true);
      return r;
    }
    let remaining = n;
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    /** @type {Node | null} */
    let node;
    while ((node = walker.nextNode())) {
      const text = /** @type {string} */ (node.nodeValue); // nœud texte : jamais null
      const count = graphemeCount(text);
      if (remaining <= count) {
        const r = document.createRange();
        r.setStart(node, graphemeIndex(text, remaining));
        r.collapse(true);
        return r;
      }
      remaining -= count;
    }
    return null;
  }

  //   #endregion


  //  #region Durable positions
  // A “live” Range does not survive a focus change: when the LinkedIn editor
  // (ProseMirror) loses focus, it rewrites its text and the Range becomes empty (as seen in the browser:
  // range.toString() === '' even though its nodes are still connected). To preserve a position
  // while a panel has focus, store it as an offset in the editor's text
  // (using the same measurement as getText) and recreate a Range when needed.

  /**
  * Offset (in UTF-16 units of getText's text) for a point in the editor.
   * @param {HTMLElement} editor
   * @param {Node} node
   * @param {number} offset
   * @returns {number}
   */
  function textOffset(editor, node, offset) {
    const r = document.createRange();
    r.setStart(editor, 0);
    r.setEnd(node, offset);
    return rangeToText(r).length;
  }

  /**
  * Start and end of a Range, as text offsets.
   * @param {HTMLElement} editor
   * @param {Range} range
   * @returns {{ start: number, end: number }}
   */
  function offsetsOf(editor, range) {
    return {
      start: textOffset(editor, range.startContainer, range.startOffset),
      end: textOffset(editor, range.endContainer, range.endOffset),
    };
  }

  /**
  * Editor point corresponding to a text offset (the end of the editor if exceeded).
   * @param {HTMLElement} editor
   * @param {number} offset
   * @returns {{ node: Node, offset: number }}
   */
  function pointAtTextOffset(editor, offset) {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    /** @type {Node | null} */
    let node;
    /** @type {Text | null} */
    let last = null;
    while ((node = walker.nextNode())) {
      const text = /** @type {Text} */ (node);
      const before = textOffset(editor, text, 0);
      if (offset >= before && offset <= before + text.length) return { node: text, offset: offset - before };
      if (offset < before) return { node: text, offset: 0 }; // The offset falls on a line break.
      last = text;
    }
    return last ? { node: last, offset: last.length } : { node: editor, offset: 0 };
  }

  /**
  * Recreate a Range from text offsets.
   * @param {HTMLElement} editor
   * @param {number} start
   * @param {number} end
   * @returns {Range}
   */
  function rangeFromOffsets(editor, start, end) {
    const a = pointAtTextOffset(editor, start);
    const b = pointAtTextOffset(editor, end);
    const r = document.createRange();
    r.setStart(a.node, a.offset);
    r.setEnd(b.node, b.offset);
    return r;
  }

  /**
  * Search for `needle` in the editor's text; if there are several, choose the one whose
  * start is closest to `near`. Return its offsets, or null if it has disappeared.
   * @param {HTMLElement} editor
   * @param {string} needle
   * @param {number} near
   * @returns {{ start: number, end: number } | null}
   */
  function findTextOffsets(editor, needle, near) {
    const text = getText(editor);
    let best = -1;
    for (let i = text.indexOf(needle); i !== -1; i = text.indexOf(needle, i + 1)) {
      if (best === -1 || Math.abs(i - near) < Math.abs(best - near)) best = i;
    }
    return best === -1 ? null : { start: best, end: best + needle.length };
  }

  /**
  * Insert text in the editor at `range` (or at the end of the text if null), replacing the
  * range's contents if it is not collapsed. Useful when focus has left the editor (e.g. a
  * panel form): restore the selection before inserting.
   * @param {HTMLElement} editor
   * @param {Range | null} range
   * @param {string} text
   * @returns {boolean}
   */
  function insertText(editor, range, text) {
    editor.focus();
    const sel = getSelectionObj();
    if (!sel) return false;
    sel.removeAllRanges();
    if (range) {
      sel.addRange(range);
    } else {
      const r = document.createRange();
      r.selectNodeContents(editor);
      r.collapse(false);
      sel.addRange(r);
    }
    let ok = false;
    // insertText with an empty string does not delete the selection: use "delete" instead.
    try { ok = text === '' ? document.execCommand('delete') : document.execCommand('insertText', false, text); } catch (_) { ok = false; }
    return ok;
  }

  /** @param {Selection} sel */
  function selectCurrentLine(sel) {
    try {
      sel.modify('move', 'backward', 'lineboundary');
      sel.modify('extend', 'forward', 'lineboundary');
    } catch (_) { /* ignore */ }
  }
//   #endregion

/** @type {LF.Editor} */
  const api = {
    currentContext, editorOfEvent, fieldType,
    rangeToText, replaceSelection, selectCurrentLine,
    textLength, rangeAtGraphemeOffset, getText, replaceAll, insertText,
    textOffset, offsetsOf, rangeFromOffsets, findTextOffsets,
  };
  root.LinkedInEditor = api;
})(globalThis);
