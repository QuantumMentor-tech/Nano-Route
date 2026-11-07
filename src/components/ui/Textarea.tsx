import React from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, disabled = false, id, className = "", style, rows = 4, ...props }, ref) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="nr-textarea-wrapper" style={{ display: "flex", flexDirection: "column", gap: "0.375rem", width: "100%" }}>
        {label && (
          <label
            htmlFor={textareaId}
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: error ? "var(--nr-status-error)" : "var(--nr-text-secondary)",
              fontFamily: "var(--nr-font-sans)",
            }}
          >
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={textareaId}
          disabled={disabled}
          rows={rows}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${textareaId}-error` : helperText ? `${textareaId}-helper` : undefined}
          className={`nr-textarea ${className}`}
          style={{
            width: "100%",
            padding: "0.625rem 0.75rem",
            backgroundColor: "var(--nr-bg-surface-elevated)",
            color: "var(--nr-text-primary)",
            border: `1px solid ${error ? "var(--nr-status-error)" : "var(--nr-border-default)"}`,
            borderRadius: "var(--nr-radius-md)",
            fontSize: "0.875rem",
            fontFamily: "var(--nr-font-sans)",
            lineHeight: 1.5,
            resize: "vertical",
            outline: "none",
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? "not-allowed" : "text",
            transition: "border-color var(--nr-transition-fast), box-shadow var(--nr-transition-fast)",
            ...style,
          }}
          {...props}
        />

        {error && (
          <p
            id={`${textareaId}-error`}
            role="alert"
            style={{
              fontSize: "0.75rem",
              color: "var(--nr-status-error)",
              marginTop: "0.125rem",
            }}
          >
            {error}
          </p>
        )}

        {!error && helperText && (
          <p
            id={`${textareaId}-helper`}
            style={{
              fontSize: "0.75rem",
              color: "var(--nr-text-muted)",
              marginTop: "0.125rem",
            }}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

