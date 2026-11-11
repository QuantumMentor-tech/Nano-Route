/**
//! Nano Route — Monospace Code Block Component
//! File: src/features/chat/components/CodeBlock.tsx
//!
//! Monospace code snippet display with language label, accessible clipboard copy,
//! and visual status feedback.
*/

import React, { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";

export interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = "code",
  className = "",
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  const handleCopy = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback for environments lacking navigator.clipboard
        const textArea = document.createElement("textarea");
        textArea.value = code;
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Ignore clipboard write failures gracefully
    }
  }, [code]);

  return (
    <div
      className={`nr-code-block ${className}`}
      style={{
        margin: "0.75rem 0",
        borderRadius: "var(--nr-radius-md, 6px)",
        border: "1px solid var(--nr-border-default)",
        backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
        overflow: "hidden",
        fontFamily: "var(--nr-font-mono, monospace)",
      }}
    >
      {/* Code Block Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.375rem 0.75rem",
          backgroundColor: "var(--nr-bg-surface, #111318)",
          borderBottom: "1px solid var(--nr-border-subtle, #1f222b)",
          fontSize: "0.75rem",
          color: "var(--nr-text-secondary, #a1a1aa)",
          userSelect: "none",
        }}
      >
        <span style={{ fontWeight: 600, textTransform: "lowercase", letterSpacing: "0.02em" }}>
          {language || "code"}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? "Code copied to clipboard" : "Copy code to clipboard"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.2rem 0.5rem",
            fontSize: "0.75rem",
            color: copied ? "var(--nr-status-success, #10b981)" : "var(--nr-text-secondary, #a1a1aa)",
            backgroundColor: "transparent",
            border: "1px solid transparent",
            borderRadius: "var(--nr-radius-sm, 4px)",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--nr-bg-surface-hover, #1f232e)";
            e.currentTarget.style.color = copied
              ? "var(--nr-status-success, #10b981)"
              : "var(--nr-text-primary, #ffffff)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = copied
              ? "var(--nr-status-success, #10b981)"
              : "var(--nr-text-secondary, #a1a1aa)";
          }}
        >
          {copied ? (
            <>
              <Check style={{ width: "13px", height: "13px" }} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy style={{ width: "13px", height: "13px" }} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <pre
        style={{
          margin: 0,
          padding: "0.75rem 1rem",
          overflowX: "auto",
          fontSize: "0.8125rem",
          lineHeight: 1.5,
          color: "var(--nr-text-primary, #ffffff)",
          tabSize: 2,
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
};

