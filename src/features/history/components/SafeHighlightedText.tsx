/**
//! Nano Route — Safe Plain-Text Highlight Renderer
//! File: src/features/history/components/SafeHighlightedText.tsx
//!
//! Renders search match highlights using pure Unicode scalar slicing and React `<mark>`
//! elements. Never constructs raw HTML strings or uses `dangerouslySetInnerHTML`.
*/

import React from "react";
import { splitHighlightSegments } from "../highlight";

export { splitHighlightSegments, type HighlightSegments } from "../highlight";

export interface SafeHighlightedTextProps {
  text: string;
  matchStart?: number | null;
  matchLength?: number | null;
  className?: string;
}

export const SafeHighlightedText: React.FC<SafeHighlightedTextProps> = ({
  text,
  matchStart,
  matchLength,
  className = "",
}) => {
  const segments = splitHighlightSegments(text, matchStart, matchLength);

  if (!segments.hasMatch) {
    return <span className={className}>{segments.before}</span>;
  }

  return (
    <span className={className}>
      {segments.before}
      <mark
        style={{
          backgroundColor: "rgba(168, 85, 247, 0.28)",
          color: "var(--nr-text-primary, #f4f4f5)",
          borderRadius: "3px",
          padding: "0 2px",
          fontWeight: 600,
          border: "1px solid rgba(168, 85, 247, 0.45)",
        }}
      >
        {segments.match}
      </mark>
      {segments.after}
    </span>
  );
};
