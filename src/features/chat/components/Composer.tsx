/**
//! Nano Route — Chat Message Composer Component
//! File: src/features/chat/components/Composer.tsx
//!
//! Multiline prompt input with bounded dynamic auto-growth, Enter/Shift+Enter keyboard
//! handling, character count tracking, and client-side validation.
*/

import React, { useRef, useState, useEffect, useCallback } from "react";
import { Send, Square } from "lucide-react";

export interface ComposerProps {
  onSubmit: (prompt: string) => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  disabled?: boolean;
  isSubmitting?: boolean;
  isCancelling?: boolean;
  placeholder?: string;
  maxLength?: number;
  initialValue?: string;
  className?: string;
}

const DEFAULT_MAX_LENGTH = 16000;
const MIN_HEIGHT = 44;
const MAX_HEIGHT = 160;

export const Composer: React.FC<ComposerProps> = ({
  onSubmit,
  onCancel,
  disabled = false,
  isSubmitting = false,
  isCancelling = false,
  placeholder = "Message Nano Route (Enter to send, Shift+Enter for new line)...",
  maxLength = DEFAULT_MAX_LENGTH,
  initialValue = "",
  className = "",
}) => {
  const [text, setText] = useState<string>(initialValue);
  const [validationError, setValidationError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync initialValue if provided externally (e.g. prompt chip click)
  useEffect(() => {
    if (initialValue) {
      setText(initialValue);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [initialValue]);

  // Adjust textarea height dynamically to content
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    const nextHeight = Math.min(Math.max(el.scrollHeight, MIN_HEIGHT), MAX_HEIGHT);
    el.style.height = `${nextHeight}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [text, adjustHeight]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    if (val.length > maxLength) {
      setValidationError(`Prompt exceeds maximum allowed length of ${maxLength.toLocaleString()} characters.`);
    } else {
      setValidationError(null);
    }
  };

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || disabled || isSubmitting) return;

    if (trimmed.length > maxLength) {
      setValidationError(`Prompt exceeds maximum allowed length of ${maxLength.toLocaleString()} characters.`);
      return;
    }

    try {
      await onSubmit(trimmed);
      setText("");
      setValidationError(null);
      // Reset height
      if (textareaRef.current) {
        textareaRef.current.style.height = `${MIN_HEIGHT}px`;
        textareaRef.current.focus();
      }
    } catch {
      // Keep input intact if submit fails
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape" && isSubmitting && onCancel && !isCancelling) {
      e.preventDefault();
      void onCancel();
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const isBlank = text.trim().length === 0;
  const canSend = !isBlank && !disabled && !isSubmitting && text.length <= maxLength;

  return (
    <div
      className={`nr-chat-composer-container ${className}`}
      style={{
        padding: "0.75rem 1.5rem 1.25rem 1.5rem",
        backgroundColor: "var(--nr-bg-app, #09090b)",
        borderTop: "1px solid var(--nr-border-subtle, #1f222b)",
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
      }}
    >
      {/* Validation Error Banner */}
      {validationError && (
        <div
          role="alert"
          style={{
            fontSize: "0.75rem",
            color: "var(--nr-status-error, #ef4444)",
            padding: "0.25rem 0.5rem",
            backgroundColor: "var(--nr-status-error-bg, rgba(239, 68, 68, 0.12))",
            borderRadius: "var(--nr-radius-sm, 4px)",
          }}
        >
          {validationError}
        </div>
      )}

      {/* Main Composer Box */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "0.5rem",
          backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
          border: "1px solid var(--nr-border-default, #27272a)",
          borderRadius: "var(--nr-radius-lg, 8px)",
          padding: "0.375rem 0.5rem 0.375rem 0.875rem",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
          transition: "border-color 0.15s ease",
        }}
        onFocusCapture={(e) => {
          e.currentTarget.style.borderColor = "var(--nr-border-focus, #7c3aed)";
        }}
        onBlurCapture={(e) => {
          e.currentTarget.style.borderColor = "var(--nr-border-default, #27272a)";
        }}
      >
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSubmitting}
          placeholder={placeholder}
          aria-label="Chat prompt input"
          rows={1}
          style={{
            flex: 1,
            backgroundColor: "transparent",
            color: "var(--nr-text-primary, #ffffff)",
            border: "none",
            outline: "none",
            resize: "none",
            padding: "0.375rem 0",
            fontSize: "0.9375rem",
            lineHeight: 1.5,
            fontFamily: "inherit",
            maxHeight: `${MAX_HEIGHT}px`,
            overflowY: text.length > 300 ? "auto" : "hidden",
          }}
        />

        {/* Action Button: Stop Generation when Submitting, Send Button otherwise */}
        {isSubmitting && onCancel ? (
          <button
            type="button"
            onClick={() => void onCancel()}
            disabled={isCancelling}
            aria-label={isCancelling ? "Stopping generation..." : "Stop generation"}
            title={isCancelling ? "Stopping generation..." : "Stop generation (Escape)"}
            data-testid="stop-generation-button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "var(--nr-radius-md, 6px)",
              backgroundColor: isCancelling
                ? "var(--nr-bg-surface-hover, #27272a)"
                : "rgba(239, 68, 68, 0.2)",
              color: isCancelling
                ? "var(--nr-text-disabled, #71717a)"
                : "var(--nr-status-error, #ef4444)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              cursor: isCancelling ? "wait" : "pointer",
              transition: "all 0.15s ease",
              flexShrink: 0,
              marginBottom: "2px",
            }}
            onMouseEnter={(e) => {
              if (!isCancelling) {
                e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.35)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isCancelling) {
                e.currentTarget.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
              }
            }}
          >
            <Square style={{ width: "13px", height: "13px", fill: "currentColor" }} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            aria-label="Send prompt"
            title={canSend ? "Send message (Enter)" : "Enter text to send"}
            data-testid="send-prompt-button"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              borderRadius: "var(--nr-radius-md, 6px)",
              backgroundColor: canSend
                ? "var(--nr-accent-purple, #7c3aed)"
                : "var(--nr-bg-surface-hover, #1f232e)",
              color: canSend ? "#ffffff" : "var(--nr-text-disabled, #52525b)",
              border: "none",
              cursor: canSend ? "pointer" : "not-allowed",
              transition: "all 0.15s ease",
              flexShrink: 0,
              marginBottom: "2px",
            }}
            onMouseEnter={(e) => {
              if (canSend) {
                e.currentTarget.style.backgroundColor = "var(--nr-accent-purple-hover, #6d28d9)";
              }
            }}
            onMouseLeave={(e) => {
              if (canSend) {
                e.currentTarget.style.backgroundColor = "var(--nr-accent-purple, #7c3aed)";
              }
            }}
          >
            <Send style={{ width: "16px", height: "16px" }} />
          </button>
        )}
      </div>

      {/* Footer bar with character count and shortcuts reminder */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 0.25rem",
          fontSize: "0.7rem",
          color: "var(--nr-text-muted, #71717a)",
        }}
      >
        <span>
          {isSubmitting
            ? isCancelling
              ? "Stopping generation..."
              : "Generating response • Press Escape or Stop to cancel"
            : "Enter to send • Shift+Enter for new line"}
        </span>
        {text.length > 0 && (
          <span
            style={{
              color:
                text.length > maxLength
                  ? "var(--nr-status-error, #ef4444)"
                  : "var(--nr-text-muted, #71717a)",
            }}
          >
            {text.length.toLocaleString()} / {maxLength.toLocaleString()}
          </span>
        )}
      </div>
    </div>
  );
};

