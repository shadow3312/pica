// @ts-check
/*
 * Export Markdown: converts styled Unicode text (bold, italic, underline,
 * strikethrough, monospace) back into Markdown syntax for reuse elsewhere (newsletter, article).
 * DOM-free, relies on unicode.js's tokenizer. Exposed on globalThis.LinkedInMarkdown.
 */
/** @param {typeof globalThis} root */
(function (root) {
  "use strict";

  if (
    typeof module !== "undefined" &&
    module.exports &&
    !root.LinkedInFormatter
  ) {
    require("./unicode.js");
  }
  const U = root.LinkedInFormatter;

  /** @typedef {{ bold: boolean, italic: boolean, mono: boolean, u: boolean, s: boolean }} RunStyle */
  /** @typedef {{ key: string, style: RunStyle, tokens: LF.Token[] }} Run */

  /**
   * @param {LF.Token[]} tokens
   * @returns {string}
   */
  function plainRun(tokens) {
    return tokens.map((t) => t.base + t.marks).join("");
  }

  // Standard Markdown has no underline syntax: use the HTML <u> tag,
  // supported as-is by most Markdown engines (GitHub...).
  /**
   * @param {string} text
   * @param {RunStyle} style
   * @returns {string}
   */
  function wrap(text, style) {
    if (!/\S/.test(text)) return text; // nothing to style in a space or line break
    // Spaces at the edges of a run break Markdown emphasis (for example, "** text**" is invalid):
    // keep them outside the markers.
    // These two patterns can be empty strings: match() never returns null here.
    const lead = /** @type {RegExpMatchArray} */ (text.match(/^\s*/))[0];
    const trail = /** @type {RegExpMatchArray} */ (text.match(/\s*$/))[0];
    let out = text.slice(lead.length, text.length - trail.length);
    if (style.mono) {
      out = "`" + out + "`";
    } else {
      if (style.bold && style.italic) out = "***" + out + "***";
      else if (style.bold) out = "**" + out + "**";
      else if (style.italic) out = "_" + out + "_";
    }
    if (style.s) out = "~~" + out + "~~";
    if (style.u) out = "<u>" + out + "</u>";
    return lead + out + trail;
  }

  // A space has no styled Unicode variant: "Bonjour test" in bold tokenizes into
  // 3 blocks (bold, neutral space, bold). Without merging, the export would produce
  // "**Bonjour** **test**" instead of "**Bonjour test**" — equivalent once rendered,
  // but with redundant markers. Therefore, merge a whitespace block with adjacent blocks
  // when they share the same style.
  /**
   * @param {Run[]} runs
   * @returns {Run[]}
   */
  function mergeWhitespaceRuns(runs) {
    const out = runs.slice();
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 1; i < out.length - 1; i++) {
        const before = out[i - 1],
          gap = out[i],
          after = out[i + 1];
        if (before.key === after.key && !/\S/.test(plainRun(gap.tokens))) {
          out.splice(i - 1, 3, {
            key: before.key,
            style: before.style,
            tokens: [...before.tokens, ...gap.tokens, ...after.tokens],
          });
          merged = true;
          break;
        }
      }
    }
    return out;
  }

  /**
   * Converts text containing styled Unicode characters into Markdown.
   * Known limitation: literal Markdown characters in the original text (*, _, `, ~)
   * are not escaped and may be misinterpreted when reassembled elsewhere.
   * @param {string} str
   * @returns {string}
   */
  function toMarkdown(str) {
    const tokens = U.tokenize(str);
    /** @type {Run[]} */
    const runs = [];
    for (const t of tokens) {
      const style = {
        bold: t.bold,
        italic: t.italic,
        mono: t.mono,
        u: t.u,
        s: t.s,
      };
      const key = JSON.stringify(style);
      const last = runs[runs.length - 1];
      if (last && last.key === key) last.tokens.push(t);
      else runs.push({ key, style, tokens: [t] });
    }
    return mergeWhitespaceRuns(runs)
      .map((r) => wrap(plainRun(r.tokens), r.style))
      .join("")
      .normalize("NFC");
  }

  // Detects the presence of Markdown syntax to decide the conversion direction (feature toggle).
  const MARKDOWN_RE =
    /\*\*\*[\s\S]+?\*\*\*|\*\*[\s\S]+?\*\*|_[\s\S]+?_|`[\s\S]+?`|~~[\s\S]+?~~|<u>[\s\S]+?<\/u>/;
  /**
   * @param {string} str
   * @returns {boolean}
   */
  function looksLikeMarkdown(str) {
    return MARKDOWN_RE.test(str);
  }

  /**
   * Re-converts Markdown (produced by toMarkdown, or written manually using the same
   * subset) into styled Unicode text. Stripping order is from the outermost to the
   * innermost delimiter to preserve the nesting produced by wrap(): <u> > ~~ > (***|**|_|`).
   * Known limitation (symmetric to toMarkdown): does not handle escaped markers (\*\*),
   * nor emphasis with a single asterisk (*text*), which is absent from our export.
   * @param {string} str
   * @returns {string}
   */
  function fromMarkdown(str) {
    let s = str;
    s = s.replace(/<u>([\s\S]+?)<\/u>/g, (_m, inner) =>
      U.setStyle(fromMarkdown(inner), { underline: true }),
    );
    s = s.replace(/~~([\s\S]+?)~~/g, (_m, inner) =>
      U.setStyle(fromMarkdown(inner), { strike: true }),
    );
    s = s.replace(/\*\*\*([\s\S]+?)\*\*\*/g, (_m, inner) =>
      U.setStyle(inner, { bold: true, italic: true }),
    );
    s = s.replace(/\*\*([\s\S]+?)\*\*/g, (_m, inner) =>
      U.setStyle(inner, { bold: true }),
    );
    s = s.replace(/`([\s\S]+?)`/g, (_m, inner) =>
      U.setStyle(inner, { mono: true }),
    );
    s = s.replace(/_([\s\S]+?)_/g, (_m, inner) =>
      U.setStyle(inner, { italic: true }),
    );
    return s;
  }

  /** @type {LF.Markdown} */
  const api = { toMarkdown, fromMarkdown, looksLikeMarkdown };
  root.LinkedInMarkdown = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
