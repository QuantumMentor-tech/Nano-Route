import React from "react";

export type BadgeVariant = "default" | "purple" | "blue" | "success" | "warning" | "error" | "info";
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "md",
  icon,
  className = "",
  style,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case "purple":
        return {
          backgroundColor: "var(--nr-accent-purple-subtle)",
          color: "var(--nr-accent-purple)",
          border: "1px solid var(--nr-accent-purple-border)",
        };
      case "blue":
        return {
          backgroundColor: "var(--nr-accent-blue-subtle)",
          color: "var(--nr-accent-blue)",
          border: "1px solid var(--nr-accent-blue-border)",
        };
      case "success":
        return {
          backgroundColor: "var(--nr-status-success-bg)",
          color: "var(--nr-status-success)",
          border: "1px solid var(--nr-status-success-border)",
        };
      case "warning":
        return {
          backgroundColor: "var(--nr-status-warning-bg)",
          color: "var(--nr-status-warning)",
          border: "1px solid var(--nr-status-warning-border)",
        };
      case "error":
        return {
          backgroundColor: "var(--nr-status-error-bg)",
          color: "var(--nr-status-error)",
          border: "1px solid var(--nr-status-error-border)",
        };
      case "info":
        return {
          backgroundColor: "var(--nr-status-info-bg)",
          color: "var(--nr-status-info)",
          border: "1px solid var(--nr-status-info-border)",
        };
      case "default":
      default:
        return {
          backgroundColor: "var(--nr-bg-surface-elevated)",
          color: "var(--nr-text-secondary)",
          border: "1px solid var(--nr-border-default)",
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case "sm":
        return {
          padding: "0.125rem 0.375rem",
          fontSize: "0.6875rem",
          height: "18px",
        };
      case "md":
      default:
        return {
          padding: "0.1875rem 0.5rem",
          fontSize: "0.75rem",
          height: "22px",
        };
    }
  };

  return (
    <span
      className={`nr-badge nr-badge-${variant} nr-badge-${size} ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.25rem",
        fontWeight: 500,
        fontFamily: "var(--nr-font-mono)",
        borderRadius: "var(--nr-radius-full)",
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      {...props}
    >
      {icon && <span style={{ display: "inline-flex", fontSize: "0.85em" }}>{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

