import React, { useRef, useState, useId } from "react";
import { Search, X } from "lucide-react";

export interface SearchFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  onClear?: () => void;
}

export const SearchField = React.forwardRef<HTMLInputElement, SearchFieldProps>(
  (
    {
      label,
      value,
      defaultValue,
      onChange,
      onClear,
      onKeyDown,
      disabled = false,
      placeholder = "Search...",
      className = "",
      style,
      id: explicitId,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = explicitId || generatedId;
    const innerRef = useRef<HTMLInputElement | null>(null);

    // Track internal value for uncontrolled or controlled clear behavior
    const isControlled = value !== undefined;
    const [internalValue, setInternalValue] = useState<string>(
      String(defaultValue ?? "")
    );
    const currentValue = isControlled ? String(value ?? "") : internalValue;

    const handleInputRef = (element: HTMLInputElement | null) => {
      innerRef.current = element;
      if (typeof ref === "function") {
        ref(element);
      } else if (ref) {
        (ref as React.MutableRefObject<HTMLInputElement | null>).current = element;
      }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!isControlled) {
        setInternalValue(e.target.value);
      }
      onChange?.(e);
    };

    const handleClear = () => {
      if (!isControlled) {
        setInternalValue("");
      }
      onClear?.();

      // Dispatch synthetic change event for controlled forms if needed
      if (innerRef.current) {
        innerRef.current.value = "";
        const syntheticEvent = new Event("input", { bubbles: true });
        innerRef.current.dispatchEvent(syntheticEvent);
        innerRef.current.focus();
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape" && currentValue.length > 0) {
        e.stopPropagation();
        handleClear();
      }
      onKeyDown?.(e);
    };

    const hasValue = currentValue.length > 0;

    return (
      <div
        className={`nr-search-field ${className}`}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.375rem",
          width: "100%",
          ...style,
        }}
      >
        {label && (
          <label
            htmlFor={inputId}
            style={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "var(--nr-text-secondary)",
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
          {/* Search Icon */}
          <span
            style={{
              position: "absolute",
              left: "0.75rem",
              color: "var(--nr-text-muted)",
              pointerEvents: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-hidden="true"
          >
            <Search style={{ width: "16px", height: "16px" }} />
          </span>

          <input
            ref={handleInputRef}
            id={inputId}
            type="search"
            role="searchbox"
            aria-label={label ? undefined : props["aria-label"] || "Search"}
            disabled={disabled}
            value={isControlled ? value : internalValue}
            placeholder={placeholder}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            style={{
              width: "100%",
              height: "36px",
              paddingTop: "0.5rem",
              paddingBottom: "0.5rem",
              paddingLeft: "2.25rem",
              paddingRight: hasValue ? "2.25rem" : "0.75rem",
              backgroundColor: "var(--nr-bg-surface-elevated)",
              color: "var(--nr-text-primary)",
              border: "1px solid var(--nr-border-default)",
              borderRadius: "var(--nr-radius-md)",
              fontSize: "0.875rem",
              fontFamily: "var(--nr-font-sans)",
              outline: "none",
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? "not-allowed" : "text",
              transition:
                "border-color var(--nr-transition-fast), box-shadow var(--nr-transition-fast)",
            }}
            {...props}
          />

          {/* Clear Button */}
          {hasValue && !disabled && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={handleClear}
              style={{
                position: "absolute",
                right: "0.5rem",
                width: "24px",
                height: "24px",
                border: "none",
                borderRadius: "var(--nr-radius-sm)",
                backgroundColor: "transparent",
                color: "var(--nr-text-muted)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                transition: "color var(--nr-transition-fast), background-color var(--nr-transition-fast)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--nr-text-primary)";
                e.currentTarget.style.backgroundColor = "var(--nr-bg-surface-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--nr-text-muted)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <X style={{ width: "14px", height: "14px" }} />
            </button>
          )}
        </div>
      </div>
    );
  }
);

SearchField.displayName = "SearchField";

