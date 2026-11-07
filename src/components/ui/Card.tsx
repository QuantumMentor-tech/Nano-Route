import React from "react";

export type CardVariant = "default" | "elevated" | "interactive" | "selected";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: "none" | "sm" | "md" | "lg";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ children, variant = "default", padding = "md", className = "", style, ...props }, ref) => {
    const getVariantStyles = (): React.CSSProperties => {
      switch (variant) {
        case "elevated":
          return {
            backgroundColor: "var(--nr-bg-surface-elevated)",
            border: "1px solid var(--nr-border-default)",
            boxShadow: "var(--nr-shadow-md)",
          };
        case "interactive":
          return {
            backgroundColor: "var(--nr-bg-surface)",
            border: "1px solid var(--nr-border-default)",
            cursor: "pointer",
            transition: "background-color var(--nr-transition-fast), border-color var(--nr-transition-fast), transform var(--nr-transition-fast)",
          };
        case "selected":
          return {
            backgroundColor: "var(--nr-bg-surface-elevated)",
            border: "1px solid var(--nr-accent-purple)",
            boxShadow: "0 0 0 1px var(--nr-accent-purple)",
          };
        case "default":
        default:
          return {
            backgroundColor: "var(--nr-bg-surface)",
            border: "1px solid var(--nr-border-default)",
          };
      }
    };

    const getPaddingStyles = (): string => {
      switch (padding) {
        case "none":
          return "0";
        case "sm":
          return "0.75rem";
        case "lg":
          return "1.5rem";
        case "md":
        default:
          return "1rem";
      }
    };

    return (
      <div
        ref={ref}
        className={`nr-card nr-card-${variant} ${className}`}
        style={{
          borderRadius: "var(--nr-radius-md)",
          padding: getPaddingStyles(),
          color: "var(--nr-text-primary)",
          ...getVariantStyles(),
          ...style,
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";

