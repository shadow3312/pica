// @ts-check
/*
 * Unicode format engine (no DOM dependencies).
 * Each char is decoded in {base, bold, italic, mono, u, d, marks}
 * then reencoded. It allows to cumulate and remove styles properly (bold+italic = bolditalic, reclick on bold should remove bold).
 */
/** @param {typeof globalThis & { LinkedInFormatter?: LF.Formatter }} root */
(function (root) {
  "use strict";

  // Unicode codepoints for styles
  const ENCODE = {
    bold: { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec },
    italic: { upper: 0x1d608, lower: 0x1d622 },
    boldItalic: { upper: 0x1d63c, lower: 0x1d656, digit: 0x1d7ec },
    mono: { upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6 },
    u: { upper: 0x1d49c, lower: 0x1d4b6 },
    d: { upper: 0x1d4d0, lower: 0x1d4ea },
  };

  // Known ranges at decoding (includes serif variants produced by other tools)
  const DECODE_SETS = [
    { upper: 0x1d5d4, lower: 0x1d5ee, digit: 0x1d7ec, bold: true }, // sans gras
    { upper: 0x1d608, lower: 0x1d622, italic: true }, // sans italique
    { upper: 0x1d63c, lower: 0x1d656, bold: true, italic: true }, // sans gras-italique
    { upper: 0x1d670, lower: 0x1d68a, digit: 0x1d7f6, mono: true }, // monospace
    { upper: 0x1d400, lower: 0x1d41a, digit: 0x1d7ce, bold: true }, // serif gras
    { upper: 0x1d434, lower: 0x1d44e, italic: true }, // serif italique
    { upper: 0x1d468, lower: 0x1d482, bold: true, italic: true },
  ];

  /** @type {Map<number, { base: string, bold: boolean, italic: boolean, mono: boolean }>} */
  const DECODE = new Map();
  for (const set of DECODE_SETS) {
    const info = { bold: !!set.bold, italic: !!set.italic, mono: !!set.mono };
    for (let i = 0; i < 26; i++) {
      DECODE.set(set.upper + i, { base: String.fromCharCode(65 + i), ...info });
      DECODE.set(set.lower + i, { base: String.fromCharCode(97 + i), ...info });
    }
    if (set.digit) {
      for (let i = 0; i < 10; i++)
        DECODE.set(set.digit + i, { base: String(i), ...info });
    }
  }
  DECODE.set(0x210e, { base: "h", bold: false, italic: true, mono: false }); // gap in the serif italic range

  const UNDERLINE = "\u0332";
  const STRIKE = "\u0336";
  const MARK_RE = /\p{M}/u;

  /**
   * @param {string} str
   * @returns {LF.Token[]}
   */
  function tokenize(str) {
    /** @type {LF.Token[]} */
    const out = [];
    // NFD: "é" becomes "e" + combining accent -> the base letter can be styled while the accent is preserved
    for (const ch of str.normalize("NFD")) {
      const cp = /** @type {number} */ (ch.codePointAt(0)); // ch is never empty, so codePointAt(0) is always defined
      const last = out[out.length - 1];
      if (last && cp === 0x0332) {
        last.u = true;
        continue;
      }
      if (last && cp === 0x0336) {
        last.s = true;
        continue;
      }
      if (last && MARK_RE.test(ch)) {
        last.marks += ch;
        continue;
      }
      const d = DECODE.get(cp);
      out.push({
        base: d ? d.base : ch,
        bold: d ? d.bold : false,
        italic: d ? d.italic : false,
        mono: d ? d.mono : false,
        u: false,
        s: false,
        marks: "",
      });
    }
    return out;
  }

  /**
   * @param {LF.Token} t
   * @returns {'mono' | 'boldItalic' | 'bold' | 'italic' | null}
   */
  function styleKey(t) {
    if (t.mono) return "mono";
    if (t.bold && t.italic) return "boldItalic";
    if (t.bold) return "bold";
    if (t.italic) return "italic";
    return null;
  }

  /** @param {LF.Token} t */
  function encodeBase(t) {
    const key = styleKey(t);
    if (!key) return t.base;
    const r = ENCODE[key];
    const c = t.base.charCodeAt(0);
    if (c >= 65 && c <= 90) return String.fromCodePoint(r.upper + c - 65);
    if (c >= 97 && c <= 122) return String.fromCodePoint(r.lower + c - 97);
    if (c >= 48 && c <= 57 && r.digit)
      return String.fromCodePoint(r.digit + c - 48);
    return t.base; // no equivalent (ex. digits in italic) -> normal character
  }

  /**
   * @param {LF.Token[]} tokens
   * @returns {string}
   */
  function render(tokens) {
    return tokens
      .map(
        (t) =>
          encodeBase(t) +
          t.marks +
          (t.u ? UNDERLINE : "") +
          (t.s ? STRIKE : ""),
      )
      .join("")
      .normalize("NFC");
  }

  // Unicode doesn't offer a styled variant for everything: digits don't exist in italic, and an accented letter (é, à, ç) would produce a styled character + floating accent, unreadable. These characters are therefore left as-is by bold/italic/mono.
  /** @param {LF.Token} t */
  const isLetter = (t) => /^[A-Za-z]$/.test(t.base) && !t.marks;
  /** @param {LF.Token} t */
  const isLetterOrDigit = (t) => /^[A-Za-z0-9]$/.test(t.base) && !t.marks;
  /** @param {LF.Token} t */
  const isLineChar = (t) => t.base !== "\n" && t.base !== "\r";

  /**
   * @type {Record<LF.FormatName, {
   *   applies: (t: LF.Token) => boolean,
   *   has: (t: LF.Token) => boolean,
   *   set: (t: LF.Token, v: boolean) => void
   * }>}
   */
  const FORMATS = {
    bold: {
      applies: isLetterOrDigit,
      has: (t) => t.bold && !t.mono,
      set: (t, v) => {
        t.bold = v;
        if (v) t.mono = false;
      },
    },
    italic: {
      applies: isLetter,
      has: (t) => t.italic && !t.mono,
      set: (t, v) => {
        t.italic = v;
        if (v) t.mono = false;
      },
    },
    mono: {
      applies: isLetterOrDigit,
      has: (t) => t.mono,
      set: (t, v) => {
        t.mono = v;
        if (v) {
          t.bold = false;
          t.italic = false;
        }
      },
    },
    underline: {
      applies: isLineChar,
      has: (t) => t.u,
      set: (t, v) => {
        t.u = v;
      },
    },
    strike: {
      applies: isLineChar,
      has: (t) => t.s,
      set: (t, v) => {
        t.s = v;
      },
    },
  };

  /**
   * Apply or remove a style on the selected characters. If the style is missing on some of them, it is applied to all; if it is present on all, it is removed from all.
   * @param {string} str
   * @param {LF.FormatName} format
   * @returns {string}
   */
  function toggle(str, format) {
    const f = FORMATS[format];
    if (!f) throw new Error("Format inconnu : " + format);
    const tokens = tokenize(str);
    const targets = tokens.filter(f.applies);
    if (!targets.length) return str;
    const allOn = targets.every(f.has);
    targets.forEach((t) => f.set(t, !allOn));
    return render(tokens);
  }

  /**
   * Force a style (true/false) on the relevant characters, regardless of their current state — unlike toggle(), which flips according to what is already present.
   * @param {string} str
   * @param {Partial<Record<LF.FormatName, boolean>>} styles
   * @returns {string}
   */
  function setStyle(str, styles) {
    const tokens = tokenize(str);
    for (const name of Object.keys(styles)) {
      const f = FORMATS[name];
      if (!f) throw new Error("Format inconnu : " + name);
      tokens.filter(f.applies).forEach((t) => f.set(t, styles[name]));
    }
    return render(tokens);
  }

  /**
   * Remove all character styles (bold, italic, mono, underline, strike).
   * @param {string} str
   * @returns {string}
   */
  function clear(str) {
    const tokens = tokenize(str);
    tokens.forEach((t) => {
      t.bold = t.italic = t.mono = t.u = t.s = false;
    });
    return render(tokens);
  }

  const BULLET_RE = /^•\s+/;
  const NUMBER_RE = /^\d+[.)]\s+/;

  /**
   * Add or remove bullets / numbers at the start of each non-empty line.
   * @param {string} str
   * @param {'bullets' | 'numbered'} type
   * @returns {string}
   */
  function toggleList(str, type) {
    const re = type === "numbered" ? NUMBER_RE : BULLET_RE;
    const lines = str.split("\n");
    const filled = lines.filter((l) => l.trim());
    if (!filled.length) return str;
    const allHave = filled.every((l) => re.test(l));
    let n = 0;
    return lines
      .map((l) => {
        if (!l.trim()) return l;
        const plain = l.replace(BULLET_RE, "").replace(NUMBER_RE, "");
        if (allHave) return plain;
        n += 1;
        return (type === "numbered" ? n + ". " : "• ") + plain;
      })
      .join("\n");
  }

  /** @type {LF.Formatter} */
  const api = { toggle, clear, toggleList, tokenize, setStyle };
  /** @type {typeof globalThis & { LinkedInFormatter?: LF.Formatter }} */ (
    root
  ).LinkedInFormatter = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
