import React from "react";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive" | "outline";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      className = "",
      style,
      type = "button",
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || isLoading;

    // Base styling using semantic CSS variables
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

    const getSizeStyles = (): React.CSSProperties => {
      switch (size) {
        case "sm":
          return {
            padding: "0.25rem 0.625rem",
            fontSize: "0.8125rem",
            borderRadius: "var(--nr-radius-sm)",
            height: "28px",
          };
        case "md":
          return {
            padding: "0.5rem 1rem",
            fontSize: "0.875rem",
            borderRadius: "var(--nr-radius-md)",
            height: "36px",
          };
        case "lg":
          return {
            padding: "0.625rem 1.25rem",
            fontSize: "0.9375rem",
            borderRadius: "var(--nr-radius-md)",
            height: "44px",
          };
      }
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        aria-busy={isLoading}
        className={`nr-button nr-button-${variant} nr-button-${size} ${className}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          fontWeight: 500,
          fontFamily: "var(--nr-font-sans)",
          cursor: isDisabled ? "not-allowed" : "pointer",
          opacity: disabled && !isLoading ? 0.5 : 1,
          transition: "background-color var(--nr-transition-fast), border-color var(--nr-transition-fast), opacity var(--nr-transition-fast)",
          userSelect: "none",
          outline: "none",
          ...getVariantStyles(),
          ...getSizeStyles(),
          ...style,
        }}
        {...props}
      >
        {isLoading && <Spinner size="sm" />}
        {!isLoading && leftIcon && <span className="nr-button-icon-left">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="nr-button-icon-right">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = "Button";

