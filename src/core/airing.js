// @ts-check
/*
 * Airing: splits dense text into small blocks of 1 to 2 sentences separated by a blank line
 * (a rhythm that reads well on LinkedIn). DOM-free, exposed on globalThis.LinkedInAiring
 * (tested in airing.test.js).
 *
 * airate(text) is idempotent: airing text that is already aired does not change it.
 *
 * Règles :
 *   - each line of text is split into sentences, then sentences are grouped in pairs
 *     when the combined length stays short (PAIR_MAX), otherwise one per block; blocks are separated
 *     by a blank line (existing blank lines are normalized, never more than one);
 *   - a sentence ends with . ! ? … (optionally followed by closing quotation marks/parentheses), then
 *     a space and an uppercase letter, digit, opening quotation mark, parenthesis, or emoji;
 *   - do not split after an abbreviation (M., Mme, Dr, etc.), an initial (J.), or a dotted acronym
 *     (e.g.), or within an address or number (no space after the period);
 *   - list lines (•, -, 1.) stay together and remain attached to the introductory line ending
 *     with ":"; a list is never split.
 */
/** @param {typeof globalThis} root */
(function (root) {
  'use strict';

  /** Maximum character length of a block containing two sentences. */
  const PAIR_MAX = 200;
  /** Text shorter than this is never considered "dense." */
  const DENSE_MIN = 300;

  const ABBREVIATIONS = new Set([
    'm', 'mm', 'mme', 'mmes', 'mlle', 'mlles', 'me', 'dr', 'pr', 'prof', 'st', 'ste', 'mr', 'mrs', 'ms',
    'cf', 'env', 'av', 'vs', 'no', 'n', 'p', 'pp', 'fig', 'ex', 'réf', 'tél', 'tel', 'bd', 'art', 'chap',
    'inc', 'ltd', 'corp', 'sr', 'jr', 'min', 'max', 'vol',
  ]);
  // "etc." is not listed: it often ends a sentence, and allowing a split is the lesser evil.

  const LIST_LINE = /^[•▪●◦‣\-–*]\s+|^\d{1,2}[.)]\s+/u;

  // Sentence ending followed by whitespace and then the start of another sentence.
  const BOUNDARY = /[.!?…]+["»”’)\]]*(?=\s+["«“(¿¡\d\p{Lu}\p{Extended_Pictographic}])/gu;

  /**
  * Does the period ending `before` belong to an abbreviation or an initial?
  * @param {string} before  current sentence text, including its final period
   * @returns {boolean}
   */
  function endsWithAbbreviation(before) {
    const word = /(\S+)$/.exec(before);
    if (!word) return false;
    const token = word[1].replace(/^["«“(\[]+/, '');
    if (/^(?:\p{L}\.-?)+$/u.test(token)) return true; // J.  J.-C.  e.g.
    const bare = token.replace(/\.+$/, '').toLowerCase();
    return ABBREVIATIONS.has(bare);
  }

  /**
   * @param {string} line
   * @returns {string[]}
   */
  function splitSentences(line) {
    /** @type {string[]} */
    const out = [];
    let start = 0;
    BOUNDARY.lastIndex = 0;
    let m;
    while ((m = BOUNDARY.exec(line))) {
      const end = m.index + m[0].length;
      const dots = m[0].replace(/["»”’)\]]+$/, '');
      // Only a single period can belong to an abbreviation ("...", "?", and "!" always split).
      if (dots === '.' && endsWithAbbreviation(line.slice(start, m.index + 1))) continue;
      out.push(line.slice(start, end));
      start = end;
      while (start < line.length && /\s/.test(line[start])) start++;
    }
    if (start < line.length) out.push(line.slice(start));
    return out;
  }

  /**
   * @param {string[]} sentences
   * @returns {string[]}
   */
  function groupSentences(sentences) {
    /** @type {string[]} */
    const groups = [];
    for (let i = 0; i < sentences.length; i++) {
      const a = sentences[i];
      const b = sentences[i + 1];
      if (b !== undefined && a.length + 1 + b.length <= PAIR_MAX) {
        groups.push(a + ' ' + b);
        i++;
      } else {
        groups.push(a);
      }
    }
    return groups;
  }

  /**
   * @param {string} input
   * @returns {string}
   */
  function airate(input) {
    const lines = String(input).replace(/\r\n?/g, '\n').split('\n');
    /** @type {Array<{ text: string, list: boolean }>} */
    const blocks = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (LIST_LINE.test(line)) {
        blocks.push({ text: line, list: true });
      } else {
        for (const g of groupSentences(splitSentences(line))) blocks.push({ text: g, list: false });
      }
    }
    let out = '';
    blocks.forEach((b, i) => {
      if (i > 0) {
        const prev = blocks[i - 1];
        const together = b.list && (prev.list || prev.text.endsWith(':'));
        out += together ? '\n' : '\n\n';
      }
      out += b.text;
    });
    return out;
  }

  /**
  * Would the text benefit from being aired? (suggest, do not enforce)
   * @param {string} text
   * @returns {boolean}
   */
  function isDense(text) {
    return text.length >= DENSE_MIN && airate(text) !== text.trim();
  }

  /** @type {LF.Airing} */
  const api = { airate, isDense };
  root.LinkedInAiring = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
