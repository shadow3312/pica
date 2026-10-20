// @ts-check
/*
 * Live Markdown typing: typing **bold**, *italic*, _italic_, `monospace`, ~~strikethrough~~, or ***bold-italic***
 * converts the text to styled Unicode as soon as the closing marker is typed. Can be enabled in the popup
 * (the “markdownTyping” setting).
 *
 * Detection is in src/core/typed-markdown.js (pure, tested, with its false-positive corpus);
 * this file only hooks it up to typing, and writing is handled by editor.js.
 *
 * Precautions:
 * - respond only when a marker character is typed (inputType “insertText”). Otherwise,
 *   undo (Ctrl+Z) would restore the raw Markdown, which would immediately be converted again:
 *   the original input could never be recovered. Ctrl+Z undoes the conversion and restores the Markdown as typed;
 * - do not run during composition (IME);
 * - examine only the text in the caret's node (see the limitation in typed-markdown.js).
 */
(function () {
  'use strict';
  const E = globalThis.LinkedInEditor;
  const F = globalThis.LinkedInFormatter;
  const TM = globalThis.LinkedInTypedMarkdown;
  const ST = globalThis.LinkedInStorage;

  E.on('input', e => {
    if (!ST.settings.get('markdownTyping')) return;
    if (e.isComposing || e.inputType !== 'insertText' || !TM.isMarker(e.data)) return;

    const ctx = E.currentContext();
    if (!ctx || !ctx.range.collapsed) return;
    const node = ctx.range.startContainer;
    if (node.nodeType !== 3) return; // Plain text only

    const caret = ctx.range.startOffset;
    const hit = TM.detect((node.nodeValue || '').slice(0, caret));
    if (!hit) return;

    // The replacement triggers another input event: its text (the styled word) is not
    // a marker character, so it is ignored above without needing to maintain a flag.
    const range = document.createRange();
    range.setStart(node, hit.start);
    range.setEnd(node, hit.end);
    E.insertText(ctx.editor, range, F.setStyle(hit.inner, hit.style));
  });
})();
