import React from "react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: SelectOption[];
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, disabled = false, id, className = "", style, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    return (
      <div className="nr-select-wrapper" style={{ display: "flex", flexDirection: "column", gap: "0.375rem", width: "100%" }}>
        {label && (
          <label
            htmlFor={selectId}
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

        <div style={{ position: "relative", width: "100%" }}>
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${selectId}-error` : helperText ? `${selectId}-helper` : undefined}
            className={`nr-select ${className}`}
            style={{
              width: "100%",
              height: "36px",
              padding: "0.5rem 2rem 0.5rem 0.75rem",
              backgroundColor: "var(--nr-bg-surface-elevated)",
              color: "var(--nr-text-primary)",
              border: `1px solid ${error ? "var(--nr-status-error)" : "var(--nr-border-default)"}`,
              borderRadius: "var(--nr-radius-md)",
              fontSize: "0.875rem",
              fontFamily: "var(--nr-font-sans)",
              appearance: "none",
              outline: "none",
              cursor: disabled ? "not-allowed" : "pointer",
              opacity: disabled ? 0.5 : 1,
              transition: "border-color var(--nr-transition-fast), box-shadow var(--nr-transition-fast)",
              ...style,
            }}
            {...props}
          >
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                style={{
                  backgroundColor: "var(--nr-bg-surface-elevated)",
                  color: "var(--nr-text-primary)",
                }}
              >
                {opt.label}
              </option>
            ))}
          </select>

          {/* Custom SVG caret indicator */}
          <span
            style={{
              position: "absolute",
              right: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "var(--nr-text-muted)",
              display: "inline-flex",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>

        {error && (
          <p
            id={`${selectId}-error`}
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
            id={`${selectId}-helper`}
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

Select.displayName = "Select";

