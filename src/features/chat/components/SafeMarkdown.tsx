/**
//! Nano Route — Safe Pure-React Markdown Parser & Renderer
//! File: src/features/chat/components/SafeMarkdown.tsx
//!
//! Renders formatted chat message text without external libraries or dangerous innerHTML.
//! Supported features:
//! - Fenced code blocks (```lang ... ```) with syntax-safe CodeBlock
//! - Headers (#, ##, ###)
//! - Blockquotes (> ...)
//! - Bulleted lists (- / *) and ordered lists (1. )
//! - Inline bold (**), italic (*), code spans (`...`), and safe external links ([text](https://...))
//! - Zero dangerouslySetInnerHTML, zero XSS vulnerability.
*/

import React from "react";
import { CodeBlock } from "./CodeBlock";
import { parseBlocks, type MarkdownBlock } from "../utils/markdownParser.ts";

export type { MarkdownBlock };

export interface SafeMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Sanitizes URLs: only http: and https: protocols are permitted.
 * Disallows javascript:, data:, vbscript:, etc.
 */
function isSafeUrl(url: string): boolean {
  try {
    const trimmed = url.trim();
    // Defense-in-depth: disallow control characters, newlines, and null bytes
    if (/[\x00-\x1F\x7F]/.test(trimmed)) {
      return false;
    }
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Parses inline formatting: bold, italic, code spans, links, and plain text.
 */
export function renderInline(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  // Regex for inline tokens:
  // 1: Code span: `([^`]+)`
  // 2: Bold: \*\*([^*]+)\*\*
  // 3: Italic: \*([^*]+)\*
  // 4: Link: \[([^\]]+)\]\(([^)]+)\)
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/;

  while (remaining.length > 0) {
    const match = remaining.match(tokenRegex);
    if (!match || match.index === undefined) {
      elements.push(<span key={`text-${keyIndex++}`}>{remaining}</span>);
      break;
    }

    // Text before match
    if (match.index > 0) {
      elements.push(
        <span key={`text-${keyIndex++}`}>{remaining.slice(0, match.index)}</span>
      );
    }

    const matchedToken = match[0];

    if (matchedToken.startsWith("`") && matchedToken.endsWith("`")) {
      // Code span
      const codeContent = matchedToken.slice(1, -1);
      elements.push(
        <code
          key={`code-${keyIndex++}`}
          style={{
            fontFamily: "var(--nr-font-mono, monospace)",
            fontSize: "0.85em",
            backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
            color: "var(--nr-accent-blue, #38bdf8)",
            padding: "0.15em 0.35em",
            borderRadius: "var(--nr-radius-sm, 4px)",
            border: "1px solid var(--nr-border-subtle, #1f222b)",
          }}
        >
          {codeContent}
        </code>
      );
    } else if (matchedToken.startsWith("**") && matchedToken.endsWith("**")) {
      // Bold
      const boldContent = matchedToken.slice(2, -2);
      elements.push(
        <strong key={`bold-${keyIndex++}`} style={{ fontWeight: 600, color: "var(--nr-text-primary, #ffffff)" }}>
          {boldContent}
        </strong>
      );
    } else if (matchedToken.startsWith("*") && matchedToken.endsWith("*")) {
      // Italic
      const italicContent = matchedToken.slice(1, -1);
      elements.push(
        <em key={`em-${keyIndex++}`} style={{ fontStyle: "italic" }}>
          {italicContent}
        </em>
      );
    } else if (matchedToken.startsWith("[") && matchedToken.includes("](") && matchedToken.endsWith(")")) {
      // Link
      const closeBracket = matchedToken.indexOf("](");
      const linkText = matchedToken.slice(1, closeBracket);
      const linkUrl = matchedToken.slice(closeBracket + 2, -1);

      if (isSafeUrl(linkUrl)) {
        elements.push(
          <a
            key={`link-${keyIndex++}`}
            href={linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: "var(--nr-accent-purple, #7c3aed)",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
            }}
          >
            {linkText}
          </a>
        );
      } else {
        elements.push(<span key={`unsafe-${keyIndex++}`}>{matchedToken}</span>);
      }
    } else {
      elements.push(<span key={`fallback-${keyIndex++}`}>{matchedToken}</span>);
    }

    remaining = remaining.slice(match.index + matchedToken.length);
  }

  return elements;
}

export const SafeMarkdown: React.FC<SafeMarkdownProps> = ({
  content,
  className = "",
}) => {
  const blocks = React.useMemo(() => parseBlocks(content), [content]);

  return (
    <div
      className={`nr-safe-markdown ${className}`}
      style={{
        lineHeight: 1.6,
        fontSize: "0.9375rem",
        color: "var(--nr-text-primary, #ffffff)",
      }}
    >
      {blocks.map((block, idx) => {
        switch (block.kind) {
          case "code":
            return (
              <CodeBlock
                key={`block-${idx}`}
                language={block.language}
                code={block.content}
              />
            );

          case "heading": {
            const headingStyle: React.CSSProperties = {
              fontWeight: 600,
              color: "var(--nr-text-primary, #ffffff)",
              marginTop: idx === 0 ? "0" : "1.25rem",
              marginBottom: "0.5rem",
              lineHeight: 1.3,
            };
            if (block.level === 1) {
              return (
                <h2 key={`block-${idx}`} style={{ ...headingStyle, fontSize: "1.25rem" }}>
                  {renderInline(block.content)}
                </h2>
              );
            }
            if (block.level === 2) {
              return (
                <h3 key={`block-${idx}`} style={{ ...headingStyle, fontSize: "1.125rem" }}>
                  {renderInline(block.content)}
                </h3>
              );
            }
            return (
              <h4 key={`block-${idx}`} style={{ ...headingStyle, fontSize: "1rem" }}>
                {renderInline(block.content)}
              </h4>
            );
          }

          case "blockquote":
            return (
              <blockquote
                key={`block-${idx}`}
                style={{
                  margin: "0.75rem 0",
                  padding: "0.5rem 0.875rem",
                  borderLeft: "3px solid var(--nr-accent-purple, #7c3aed)",
                  backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                  borderRadius: "0 var(--nr-radius-sm, 4px) var(--nr-radius-sm, 4px) 0",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                  fontStyle: "italic",
                }}
              >
                {renderInline(block.content)}
              </blockquote>
            );

          case "unordered-list":
            return (
              <ul
                key={`block-${idx}`}
                style={{
                  margin: "0.5rem 0",
                  paddingLeft: "1.5rem",
                  listStyleType: "disc",
                }}
              >
                {block.items.map((item, itemIdx) => (
                  <li key={`li-${itemIdx}`} style={{ margin: "0.25rem 0" }}>
                    {renderInline(item)}
                  </li>
                ))}
              </ul>
            );

          case "ordered-list":
            return (
              <ol
                key={`block-${idx}`}
                style={{
                  margin: "0.5rem 0",
                  paddingLeft: "1.5rem",
                  listStyleType: "decimal",
                }}
              >
                {block.items.map((item, itemIdx) => (
                  <li key={`ol-li-${itemIdx}`} style={{ margin: "0.25rem 0" }}>
                    {renderInline(item)}
                  </li>
                ))}
              </ol>
            );

          case "paragraph":
          default:
            return (
              <p
                key={`block-${idx}`}
                style={{
                  margin: "0.5rem 0",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {renderInline(block.content)}
              </p>
            );
        }
      })}
    </div>
  );
};

