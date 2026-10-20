// @ts-check
/*
 * Paste cleaner: repairs text copied from Word, a PDF, a website, or an email before it
 * is inserted into a post. DOM-free; exposed as globalThis.LinkedInPasteCleanup (tested in paste-cleanup.test.js).
 *
 * clean(text) is idempotent and never changes text already styled in Unicode, emoji (the joiner
 * U+200D is preserved), or intended French typography (non-breaking spaces U+00A0 / U+202F and
 * quotation marks « » “ ” are left as is). Rules, in order:
 *   1. line endings become \n; invisible characters are removed (zero-width, soft hyphen,
 *      BOM); exotic spaces (em spaces, ideographic spaces, etc.) become regular spaces;
 *   2. Word / PDF bullets (■ ● ○ ▪ ➢ ➤ ► ‣ ⁃ and private-use Symbol glyphs) become « • »;
 *   3. words split by a hyphen at the end of a line (PDF) are rejoined when the next part
 *      starts with a lowercase letter;
 *   4. exotic dashes and quotation marks (‐ ‑ ‒; „ ‟ ‚ ‛) are replaced with safe forms;
 *   5. spaces: tabs and repeated spaces are reduced, line-edge spaces are removed, no more than
 *      one blank line in a row, blank lines removed at the beginning and end;
 *   6. tracking parameters are removed from URLs (utm_*, fbclid, gclid, trk...).
 *
 * Known limitations: « porte-\nmonnaie » (a real hyphen at the end of a line) becomes
 * « portemonnaie »; lines starting with « - », « – » and « * » are not converted to bullets (too ambiguous:
 * dialogue, Markdown); in single-line text, leading and trailing spaces are preserved (pasting
 * into the middle of a sentence); in multi-line text, leading and trailing spaces on each line are removed.
 */
/** @param {typeof globalThis} root */
(function (root) {
  'use strict';

  const BULLET = '•';

  // Bullet glyphs: common symbols, plus private-use codes Word uses for the Symbol/Wingdings fonts.
  const BULLET_LINE = /^[ \t]*[■□▪▫●○◦◾◽▶►➢➤➣‣⁃∙·]\s+|^[ \t]*[\uF0A7\uF0B7\uF076\uF0D8\uF0FC]\s*/gm;

  // Tracking parameters that do not affect the destination page. Intentionally cautious: excludes "ref", "source", etc.
  const TRACKING_PARAM = /^(utm_[a-z0-9_]*|fbclid|gclid|dclid|msclkid|yclid|igshid|mc_cid|mc_eid|mkt_tok|_hsenc|_hsmi|trk|trkinfo|trkemail|lipi|midtoken|midsig|trackingid|refid|rcm)$/i;

  /**
   * @param {string} url
   * @returns {string}
   */
  function stripTracking(url) {
    const q = url.indexOf('?');
    if (q === -1) return url;
    const hashAt = url.indexOf('#', q);
    const head = url.slice(0, q);
    const query = url.slice(q + 1, hashAt === -1 ? undefined : hashAt);
    const hash = hashAt === -1 ? '' : url.slice(hashAt);
    const kept = query.split('&').filter(pair => {
      if (!pair) return false;
      const name = pair.split('=')[0];
      let decoded = name;
      try { decoded = decodeURIComponent(name); } catch (_) { /* malformed name: keep it as is */ }
      return !TRACKING_PARAM.test(decoded);
    });
    return head + (kept.length ? '?' + kept.join('&') : '') + hash;
  }

  /**
   * @param {string} text
   * @returns {string}
   */
  function cleanUrls(text) {
    return text.replace(/https?:\/\/[^\s<>"«»]+/g, match => {
      // Trailing sentence punctuation is not part of the URL.
      const tail = /[.,;:!?)\]}'’”]+$/.exec(match);
      const url = tail ? match.slice(0, tail.index) : match;
      return stripTracking(url) + (tail ? tail[0] : '');
    });
  }

  /**
   * @param {string} input
   * @returns {string}
   */
  function clean(input) {
    let s = String(input);

    // 1. Line endings and invisible characters
    s = s.replace(/\r\n?|\u2028|\u2029|\u0085/g, '\n');
    s = s.replace(/[\u200B\u200C\u2060\uFEFF\u00AD\u200E\u200F]/g, '');
    s = s.replace(/[\u2000-\u200A\u205F\u3000\u1680]/g, ' ');

    // 2. Bullets
    s = s.replace(BULLET_LINE, BULLET + ' ');

    // 3. Words split at the end of a line (« informa-\ntion »)
    s = s.replace(/(\p{L})-[ \t]*\n[ \t]*(\p{Ll})/gu, '$1$2');

    // 4. Exotic dashes and quotation marks
    s = s.replace(/[‐‑‒]/g, '-').replace(/―/g, '—');
    s = s.replace(/[„‟]/g, '"').replace(/[‚‛]/g, "'");

    // 5. Spaces and blank lines
    s = s.replace(/\t/g, ' ');
    // Single line: edge spaces may be intentional (pasting into the middle of a sentence), so keep them.
    const single = !s.includes('\n');
    s = s.split('\n').map(line => {
      const l = line.replace(/ {2,}/g, ' ');
      return single ? l : l.replace(/^ | $/g, '');
    }).join('\n');
    s = s.replace(/\n{3,}/g, '\n\n');
    s = s.replace(/^\n+|\n+$/g, '');

    // 6. URLs
    return cleanUrls(s);
  }

  /** @type {LF.PasteCleanup} */
  const api = { clean };
  root.LinkedInPasteCleanup = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);