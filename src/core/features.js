// @ts-check
/*
 * Feature registry: a single definition for each action (transformation,
 * shortcut, button), so multiple lists no longer need to be kept in sync.
 * DOM-free (like unicode.js): never touches the editor, only the text.
 * Exposed on globalThis.LinkedInFeatures.
 */
/** @param {typeof globalThis & { LinkedInFormatter?: LF.LinkedInFormatter }} root */

(function (root) {
  'use strict';

  if (typeof module !== 'undefined' && module.exports && !LinkedInFormatter) {
    require('./unicode.js');
  }
  const F = LinkedInFormatter;

  /** @type {LF.Feature[]} */
  const registry = [];

  /**
   * feature = {
   *   id: string (unique),
   *   run: (text) => text,                          // transformation pure
   *   toolbar?: { label, title },                    // omis = pas de bouton
   *   shortcut?: { key } | { key, shift: true } | { code, shift: true },
   *   line?: true,                                   // s'applique à la ligne courante si rien n'est sélectionné
   *   contexts?: ['post', 'comment', 'message'],      // omis = tous les champs
   * }
   * @param {LF.Feature} feature
   */
  function register(feature) {
    if (!feature || typeof feature.id !== 'string' || !feature.id) {
      throw new Error('Invalid feature : missing id');
    }
    if (typeof feature.run !== 'function') {
      throw new Error('Invalid feature : missing run (' + feature.id + ')');
    }
    if (registry.some(f => f.id === feature.id)) {
      throw new Error('Feature already registered : ' + feature.id);
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
    if (!f) throw new Error('Feature inconnue : ' + id);
    return f.run(text);
  }

  // ---------- Historic actions (bold, italic, lists...) ----------
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
  // e.code : fonctionne en AZERTY comme en QWERTY, contrairement à e.key sur Maj+chiffre
  register({ id: 'bullets', run: t => F.toggleList(t, 'bullets'), line: true,
    toolbar: { label: '•', title: 'Liste à puces (Ctrl+Maj+8)' }, shortcut: { code: 'Digit8', shift: true } });
  register({ id: 'numbered', run: t => F.toggleList(t, 'numbered'), line: true,
    toolbar: { label: '1.', title: 'Liste numérotée (Ctrl+Maj+7)' }, shortcut: { code: 'Digit7', shift: true } });
  register({ id: 'clear', run: t => F.clear(t),
    toolbar: { label: '⌫', title: 'Effacer le formatage' } });



  /**
   * Check if the feature's shortcut matches the keyboard event.
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
  LinkedInFeatures = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
