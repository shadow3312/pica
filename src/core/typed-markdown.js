// @ts-check
/*
 * Live Markdown detection: without DOM or chrome.*. Exposed on
 * globalThis.LinkedInTypedMarkdown. The widget (src/widgets/markdown-typing.js) provides the text
 * before the cursor at the moment a marker is typed, and it responds with "what was just closed,
 * and in which style" (or nothing).
 *
 * Recognized syntaxes (longest first, so "**" is not interpreted as two "*" signs):
 *   ***bold-italic***   **bold**   ~~strikethrough~~   `mono`   *italic*   _italic_
 * Intentionally not recognized: __bold__ (too close to __init__ and variable names).
 *
 * Rules to avoid false positives (inspired by CommonMark):
 * - the opening marker is not attached to a preceding letter or digit: "nom_variable_ici",
 *   "2*3*4" and "2**3**4" are not Markdown; nor to a closing parenthesis, bracket, or brace:
 *   "(a+b)*(c+d)*e" and "arr[i]*w[j]*z" are multiplications, not italics
 *   (CommonMark would convert them; what is tolerated in a rendered document is too risky to type);
 * - the text between markers does not start or end with a space: "a * b * c" is not italic;
 * - the text between markers is non-empty and fits on one line;
 * - the opening marker is not itself the end of a longer marker: typing **gras* (with a single closing "*")
 *   does not trigger italics on the second opening "*".
 * Accents count as letters ("é**a**" is not converted).
 *
 * Known limitation: detection only sees the text of the cursor node provided by the caller; a
 * mention or link between the opening marker and the cursor prevents it from triggering.
 */
/** @param {typeof globalThis} root */
(function (root) {
  'use strict';

  /** Characters whose typing can close a syntax. */
  const MARKERS = ['*', '_', '`', '~'];

  /**
   * @typedef {{ re: RegExp, style: Partial<Record<LF.FormatName, boolean>>, marker: string, trimEdges: boolean }} Rule
   * `marker`: the character that must not precede the opening marker (it would be part of a longer marker).
   * `trimEdges`: reject whitespace at the edges of the text (false for mono: code can begin with a space).
   */
  /** @type {Rule[]} */
  const RULES = [
    { re: /\*\*\*([^*\n]+)\*\*\*$/, style: { bold: true, italic: true }, marker: '*', trimEdges: true },
    { re: /\*\*([^*\n]+)\*\*$/,     style: { bold: true },               marker: '*', trimEdges: true },
    { re: /~~([^~\n]+)~~$/,         style: { strike: true },             marker: '~', trimEdges: true },
    { re: /`([^`\n]+)`$/,           style: { mono: true },               marker: '`', trimEdges: false },
    { re: /\*([^*\n]+)\*$/,         style: { italic: true },             marker: '*', trimEdges: true },
    { re: /_([^_\n]+)_$/,           style: { italic: true },             marker: '_', trimEdges: true },
  ];

  const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
  const CLOSING_BRACKET = /[)\]}]/;

  /**
   * Can the typed character close a syntax? (check before doing any calculation)
   * @param {string | null | undefined} ch
   * @returns {boolean}
   */
  function isMarker(ch) {
    return typeof ch === 'string' && ch.length === 1 && MARKERS.includes(ch);
  }

  /**
   * @param {string} before  text before the cursor, on the current line
   * @returns {{ start: number, end: number, inner: string, style: Partial<Record<LF.FormatName, boolean>> } | null}
   *   start/end: the range to replace (including markers), in offsets within `before`
   */
  function detect(before) {
    if (!isMarker(before.slice(-1))) return null;
    for (const rule of RULES) {
      const m = rule.re.exec(before);
      if (!m) continue;
      const inner = m[1];
      const prev = before[m.index - 1];
      if (prev && (LETTER_OR_DIGIT.test(prev) || CLOSING_BRACKET.test(prev) || prev === rule.marker)) continue;
      if (rule.trimEdges && (/^\s/.test(inner) || /\s$/.test(inner))) continue;
      return { start: m.index, end: m.index + m[0].length, inner, style: rule.style };
    }
    return null;
  }

  /**
   * '- ' at the start of a line: start of a bulleted list. Returns the text that replaces `before`
   * in its entirety (the same bullet as toggleList in unicode.js), or null. A non-breaking space
   * also counts: some editors produce one when a space is typed at the end of text.
   * @param {string} before  text of the current line before the cursor
   * @returns {string | null}
   */
  function detectBullet(before) {
    return /^-[  ]$/.test(before) ? '• ' : null;
  }

  /** @type {LF.TypedMarkdown} */
  const api = { detect, isMarker, detectBullet };
  root.LinkedInTypedMarkdown = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
