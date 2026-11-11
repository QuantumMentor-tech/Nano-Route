/**
//! Nano Route — Safe Plain-Text Highlight Segmentation Helper
//! File: src/features/history/highlight.ts
//!
//! Splits text strictly along Unicode code point boundaries (`Array.from`) for
//! React `<mark>` rendering without constructing raw HTML strings.
*/

export interface HighlightSegments {
  before: string;
  match: string;
  after: string;
  hasMatch: boolean;
}

/**
 * Splits `text` safely along Unicode code point boundaries (`Array.from`) matching
 * the character offsets computed by the Rust/mock search engine (`chars().collect()`).
 * Any out-of-range, negative, or zero-length offset degrades safely to unhighlighted text.
 */
export function splitHighlightSegments(
  text: string,
  matchStart: number | null | undefined,
  matchLength: number | null | undefined
): HighlightSegments {
  if (
    typeof matchStart !== "number" ||
    typeof matchLength !== "number" ||
    !Number.isFinite(matchStart) ||
    !Number.isFinite(matchLength) ||
    matchStart < 0 ||
    matchLength <= 0
  ) {
    return {
      before: text,
      match: "",
      after: "",
      hasMatch: false,
    };
  }

  const chars = Array.from(text);
  const start = Math.floor(matchStart);
  const len = Math.floor(matchLength);

  if (start >= chars.length) {
    return {
      before: text,
      match: "",
      after: "",
      hasMatch: false,
    };
  }

  const end = Math.min(chars.length, start + len);
  if (end <= start) {
    return {
      before: text,
      match: "",
      after: "",
      hasMatch: false,
    };
  }

  return {
    before: chars.slice(0, start).join(""),
    match: chars.slice(start, end).join(""),
    after: chars.slice(end).join(""),
    hasMatch: true,
  };
}

