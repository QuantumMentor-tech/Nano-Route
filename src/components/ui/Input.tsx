import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      disabled = false,
      id,
      className = "",
      style,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="nr-input-wrapper" style={{ display: "flex", flexDirection: "column", gap: "0.375rem", width: "100%" }}>
        {label && (
          <label
            htmlFor={inputId}
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

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            width: "100%",
          }}
        >
          {leftIcon && (
            <span
              style={{
                position: "absolute",
                left: "0.75rem",
                color: "var(--nr-text-muted)",
                pointerEvents: "none",
                display: "inline-flex",
              }}
            >
              {leftIcon}
            </span>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
            className={`nr-input ${className}`}
            style={{
              width: "100%",
              height: "36px",
              paddingTop: "0.5rem",
              paddingBottom: "0.5rem",
              paddingLeft: leftIcon ? "2.25rem" : "0.75rem",
              paddingRight: rightIcon ? "2.25rem" : "0.75rem",
              backgroundColor: "var(--nr-bg-surface-elevated)",
              color: "var(--nr-text-primary)",
              border: `1px solid ${error ? "var(--nr-status-error)" : "var(--nr-border-default)"}`,
              borderRadius: "var(--nr-radius-md)",
              fontSize: "0.875rem",
              fontFamily: "var(--nr-font-sans)",
              outline: "none",
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? "not-allowed" : "text",
              transition: "border-color var(--nr-transition-fast), box-shadow var(--nr-transition-fast)",
              ...style,
            }}
            {...props}
          />

          {rightIcon && (
            <span
              style={{
                position: "absolute",
                right: "0.75rem",
                color: "var(--nr-text-muted)",
                pointerEvents: "none",
                display: "inline-flex",
              }}
            >
              {rightIcon}
            </span>
          )}
        </div>

        {error && (
          <p
            id={`${inputId}-error`}
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
            id={`${inputId}-helper`}
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

Input.displayName = "Input";

