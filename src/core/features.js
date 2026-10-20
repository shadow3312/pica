// @ts-check
/*
 * Feature registry: a single definition per action (transformation, shortcut,
 * button), eliminating the need to synchronize multiple separate lists.
 * DOM-free (like unicode.js): never touches the editor, only the text.
 * Exposed as globalThis.LinkedInFeatures.
 */
/** @param {typeof globalThis} root */
(function (root) {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && !root.LinkedInFormatter) {
    require('./unicode.js');
  }
  if (typeof module !== 'undefined' && module.exports && !root.LinkedInTypography) {
    require('./typography.js');
  }
  if (typeof module !== 'undefined' && module.exports && !root.LinkedInMarkdown) {
    require('./markdown.js');
  }
  if (typeof module !== 'undefined' && module.exports && !root.LinkedInPasteCleanup) {
    require('./paste-cleanup.js');
  }
  if (typeof module !== 'undefined' && module.exports && !root.LinkedInAiring) {
    require('./airing.js');
  }
  const F = root.LinkedInFormatter;
  const T = root.LinkedInTypography;
  const MD = root.LinkedInMarkdown;
  const PC = root.LinkedInPasteCleanup;
  const AI = root.LinkedInAiring;

  /** @type {LF.Feature[]} */
  const registry = [];

  /**
  * feature = {
   *   id: string (unique),
   *   run: (text) => text,                          // transformation pure
  *   toolbar?: { label, title },                    // omitted = no button
   *   shortcut?: { key } | { key, shift: true } | { code, shift: true },
  *   line?: true,                                   // applies to the current line if nothing is selected
   *   contexts?: ['post', 'comment', 'message'],      // omis = tous les champs
   * }
   * @param {LF.Feature} feature
   */
  function register(feature) {
    if (!feature || typeof feature.id !== 'string' || !feature.id) {
      throw new Error('Invalid feature: missing id');
    }
    if (typeof feature.run !== 'function') {
      throw new Error('Invalid feature: missing run (' + feature.id + ')');
    }
    if (registry.some(f => f.id === feature.id)) {
      throw new Error('Feature already registered: ' + feature.id);
    }
    registry.push(feature);
  }

  /**
   * @param {string} id
   * @returns {LF.Feature | null}
   */
  function get(id) { return registry.find(f => f.id === id) || null; }

  /** @returns {LF.Feature[]} */
  function list() { return registry.slice(); }

  /**
   * @param {string} id
   * @param {string} text
   * @returns {string}
   */
  function run(id, text) {
    const f = get(id);
    if (!f) throw new Error('Unknown feature: ' + id);
    return f.run(text);
  }

  // ---------- Legacy actions (bold, italic, lists...) ----------
  register({ id: 'bold', run: t => F.toggle(t, 'bold'),
    toolbar: { label: '𝗕', title: 'Gras (Ctrl+B)' }, shortcut: { key: 'b' } });
  register({ id: 'italic', run: t => F.toggle(t, 'italic'),
    toolbar: { label: '𝘐', title: 'Italique (Ctrl+I)' }, shortcut: { key: 'i' } });
  register({ id: 'underline', run: t => F.toggle(t, 'underline'),
    toolbar: { label: 'U̲', title: 'Souligné (Ctrl+U)' }, shortcut: { key: 'u' } });
  register({ id: 'strike', run: t => F.toggle(t, 'strike'),
    toolbar: { label: 'S̶', title: 'Barré (Ctrl+Maj+X)' }, shortcut: { key: 'x', shift: true } });
  register({ id: 'mono', run: t => F.toggle(t, 'mono'),
    toolbar: { label: '𝙼', title: 'Monospace (Ctrl+Maj+M)' }, shortcut: { key: 'm', shift: true } });
  
  register({ id: 'bullets', run: t => F.toggleList(t, 'bullets'), line: true,
    toolbar: { label: '•', title: 'Liste à puces (Ctrl+Maj+8)' }, shortcut: { code: 'Digit8', shift: true } });
  register({ id: 'numbered', run: t => F.toggleList(t, 'numbered'), line: true,
    toolbar: { label: '1.', title: 'Liste numérotée (Ctrl+Maj+7)' }, shortcut: { code: 'Digit7', shift: true } });
  register({ id: 'clear', run: t => F.clear(t),
    toolbar: { label: '⌫', title: 'Effacer le formatage' } });

  register({ id: 'french-typography', run: t => T.apply(t),
    toolbar: { label: 'Fr', title: 'Typographie française (Ctrl+Maj+F)' }, shortcut: { key: 'f', shift: true } });

  register({ id: 'paste-cleanup', run: t => PC.clean(t), line: true,
    toolbar: { label: '🧹', title: 'Nettoyer le texte (Ctrl+Maj+L)' }, shortcut: { key: 'l', shift: true } });

  register({ id: 'air', run: t => AI.airate(t), wholeText: true,
    toolbar: { label: '¶', title: 'Aérer le texte (Ctrl+Maj+K)' }, shortcut: { key: 'k', shift: true } });

  // ---------- Export ----------
  // Toggle: detected Markdown in the selection is converted back to Unicode; otherwise, export as Markdown.
  register({ id: 'markdown-export', run: t => (MD.looksLikeMarkdown(t) ? MD.fromMarkdown(t) : MD.toMarkdown(t)),
    toolbar: { label: 'md', title: 'Markdown ⇄ Unicode (Ctrl+Maj+E)' }, shortcut: { key: 'e', shift: true } });

  /**
  * Does the feature shortcut match this keyboard event?
   * @param {LF.Feature} feature
   * @param {{ shiftKey: boolean, code?: string }} e
   * @param {string} lowerKey
   * @returns {boolean}
   */
  function matchesShortcut(feature, e, lowerKey) {
    const s = feature.shortcut;
    if (!s) return false;
    if (!!s.shift !== e.shiftKey) return false;
    return s.code ? e.code === s.code : s.key === lowerKey;
  }

  /** @type {LF.Features} */
  const api = { register, get, list, run, matchesShortcut };
  root.LinkedInFeatures = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
