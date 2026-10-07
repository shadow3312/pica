// @ts-check
/*
 * French typography: non-breaking spaces before : ; ! ?, guillemets « » and
 * curly apostrophes. DOM-free, like unicode.js. Exposed on globalThis.LinkedInTypography.
 */
/** @param {typeof globalThis} root */
(function (root) {
  "use strict";

  const NNBSP = " "; // narrow non-breaking space (before ; : ! ?)
  const NBSP = " "; // non-breaking space (before :)

  /**
   * Applies French typography rules to a text.
   * Idempotent: applying it twice yields the same result as applying it once.
   * Known limitation: straight guillemets are converted in simple pairs (no
   * handling of nested guillemets), and text inside URLs is not excluded.
   * @param {string} str
   * @returns {string}
   */
  function apply(str) {
    let s = str;
    // Straight guillemets in pairs -> French guillemets with a narrow non-breaking space
    s = s.replace(
      /"([^"]*)"/g,
      (_m, inner) => "«" + NNBSP + inner.trim() + NNBSP + "»",
    );
    // Apostrophe between letters -> curly apostrophe
    s = s.replace(/(\p{L})'(\p{L})/gu, "$1’$2");
    // Narrow non-breaking space before ; ! ? (replaces existing spaces to remain idempotent)
    s = s.replace(/[   ]*([;!?])/g, NNBSP + "$1");
    // Non-breaking space before :
    s = s.replace(/[   ]*(:)/g, NBSP + "$1");
    return s;
  }

  /** @type {LF.Typography} */
  const api = { apply };
  root.LinkedInTypography = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
