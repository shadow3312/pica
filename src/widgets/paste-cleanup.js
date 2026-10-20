// @ts-check
/*
 * Automatic paste cleanup (the « pasteCleanup » setting). The rule is in
 * src/core/paste-cleanup.js; this file applies it to clipboard text before it enters
 * the editor. The same cleanup is available for existing text (Ctrl+Shift+L, feature
 * « paste-cleanup »).
 *
 * - We only intervene if cleanup changes something: text that's already clean is pasted by
 *   the editor itself, as usual.
 * - Otherwise, we cancel the native paste (preventDefault, before the editor: capture phase) and
 *   insert the cleaned text with insertText, like typing: Ctrl+Z undoes the entire paste.
 * - Only LinkedIn fields (a recognized active editor) are affected; plain clipboard text is used
 *   (LinkedIn only accepts text).
 */
(function () {
  'use strict';
  const E = globalThis.LinkedInEditor;
  const PC = globalThis.LinkedInPasteCleanup;
  const ST = globalThis.LinkedInStorage;

  E.on('paste', e => {
    if (!ST.settings.get('pasteCleanup') || e.defaultPrevented) return;
    const editor = E.editorOfEvent(e);
    if (!editor || !e.clipboardData) return;

    const raw = e.clipboardData.getData('text/plain');
    if (!raw) return; // Image or file: let the default behavior handle it.
    const cleaned = PC.clean(raw);
    if (cleaned === raw) return;

    const ctx = E.currentContext();
    const range = ctx && ctx.editor === editor && ctx.sel.rangeCount ? ctx.sel.getRangeAt(0) : null;
    e.preventDefault();
    if (!E.insertText(editor, range, cleaned)) {
      // Insertion failed: raw text is better than nothing.
      E.insertText(editor, range, raw);
    }
  });
})();
