// @ts-check
/*
 * Templates with variables: DOM-free. A template is text containing {{variables}}.
 * - {{date}} and {{date_courte}} are filled automatically (today's date, in French).
 * - Any other variable ({{cohort}}...) is requested from the user when inserted.
 * Exposed on globalThis.LinkedInTemplates.
 *
 */
/** @param {typeof globalThis} root */
(function (root) {
  'use strict';

  const VAR_RE = /\{\{\s*([\p{L}\p{N}_-]+)\s*\}\}/gu;

  /** @type {Record<string, (now: Date) => string>} */
  const BUILTINS = {
    date: now => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(now),
    date_courte: now => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(now),
  };

  /**
   * @param {string} name
   * @param {Date} now
   * @returns {string | undefined}
   */
  function builtinValue(name, now) {
    const fn = BUILTINS[name.toLowerCase()];
    return fn ? fn(now) : undefined;
  }

  /**
   * Names of variables to request (unique, in the order of appearance), excluding automatic variables.
   * @param {string} text
   * @returns {string[]}
   */
  function extractVariables(text) {
    /** @type {Set<string>} */
    const seen = new Set();
    for (const m of text.matchAll(VAR_RE)) {
      if (!BUILTINS[m[1].toLowerCase()]) seen.add(m[1]);
    }
    return [...seen];
  }

  /**
   * Replaces variables. `values` = { name: value } for custom variables.
   * A custom variable missing from `values` is left as-is ({{name}});
   * an empty value replaces it with an empty string.
   * @param {string} text
   * @param {Record<string, string>} [values]
   * @param {Date} [now]
   * @returns {string}
   */
  function fill(text, values, now) {
    const when = now || new Date();
    return text.replace(VAR_RE, (whole, name) => {
      const auto = builtinValue(name, when);
      if (auto !== undefined) return auto;
      return values && Object.prototype.hasOwnProperty.call(values, name) ? String(values[name]) : whole;
    });
  }

  const END_RE = /\{\{\s*([\p{L}\p{N}_-]+)\s*\}\}$/u;

  /**
   * If `str` ends with a complete variable ({{name}}), returns { name, raw } (raw = the
   * exact text to replace, including internal spaces), otherwise null. Used for inline
   * replacement while typing: it receives the text before the cursor.
   * @param {string} str
   * @returns {{ name: string, raw: string } | null}
   */
  function matchVariableAtEnd(str) {
    const m = END_RE.exec(str);
    return m ? { name: m[1], raw: m[0] } : null;
  }

  /** @type {LF.Templates} */
  const api = { extractVariables, fill, matchVariableAtEnd };
  /** @type {typeof globalThis & { LinkedInTemplates: LF.Templates }} */
  const rootWithTemplates = root;
  rootWithTemplates.LinkedInTemplates = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
