import React from "react";
import { ButtonVariant, ButtonSize } from "./Button";
import { Spinner } from "./Spinner";

export interface IconButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: React.ReactNode;
  "aria-label": string; // Mandatory for accessibility
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      icon,
      "aria-label": ariaLabel,
      variant = "ghost",
      size = "md",
      isLoading = false,
      disabled = false,
      className = "",
      style,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    const sizeDimensions = {
      sm: { width: "28px", height: "28px", fontSize: "14px" },
      md: { width: "36px", height: "36px", fontSize: "16px" },
      lg: { width: "44px", height: "44px", fontSize: "20px" },
    }[size];

    const getVariantStyles = (): React.CSSProperties => {
      switch (variant) {
        case "primary":
          return {
            backgroundColor: "var(--nr-accent-purple)",
            color: "var(--nr-text-primary)",
            border: "1px solid transparent",
          };
        case "secondary":
          return {
            backgroundColor: "var(--nr-bg-surface-elevated)",
            color: "var(--nr-text-primary)",
            border: "1px solid var(--nr-border-default)",
          };
        case "outline":
          return {
            backgroundColor: "transparent",
            color: "var(--nr-text-primary)",
            border: "1px solid var(--nr-border-default)",
          };
        case "ghost":
          return {
            backgroundColor: "transparent",
            color: "var(--nr-text-secondary)",
            border: "1px solid transparent",
          };
        case "destructive":
          return {
            backgroundColor: "var(--nr-status-error)",
            color: "var(--nr-text-primary)",
            border: "1px solid transparent",
          };
      }
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-label={ariaLabel}
        aria-busy={isLoading}
        title={ariaLabel}
        className={`nr-icon-button nr-icon-button-${variant} nr-icon-button-${size} ${className}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "var(--nr-radius-md)",
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: disabled && !isLoading ? 0.5 : 1,
          transition: "background-color var(--nr-transition-fast), border-color var(--nr-transition-fast), color var(--nr-transition-fast)",
          outline: "none",
          ...sizeDimensions,
          ...getVariantStyles(),
          ...style,
        }}
        {...props}
      >
        {isLoading ? <Spinner size="sm" /> : icon}
      </button>
    );
  }
);

IconButton.displayName = "IconButton";

