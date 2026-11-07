import React from "react";
import {
  Info,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
} from "lucide-react";

export type AlertVariant = "info" | "success" | "warning" | "error";

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  onDismiss?: () => void;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = ({
  variant = "info",
  title,
  children,
  onDismiss,
  action,
  icon,
  className = "",
  style,
  ...props
}) => {
  const getVariantConfig = () => {
    switch (variant) {
      case "success":
        return {
          bg: "var(--nr-status-success-bg)",
          border: "var(--nr-status-success-border)",
          text: "var(--nr-status-success)",
          defaultIcon: <CheckCircle2 style={{ width: "18px", height: "18px" }} />,
          role: "status",
        };
      case "warning":
        return {
          bg: "var(--nr-status-warning-bg)",
          border: "var(--nr-status-warning-border)",
          text: "var(--nr-status-warning)",
          defaultIcon: <AlertTriangle style={{ width: "18px", height: "18px" }} />,
          role: "alert",
        };
      case "error":
        return {
          bg: "var(--nr-status-error-bg)",
          border: "var(--nr-status-error-border)",
          text: "var(--nr-status-error)",
          defaultIcon: <AlertCircle style={{ width: "18px", height: "18px" }} />,
          role: "alert",
        };
      case "info":
      default:
        return {
          bg: "var(--nr-accent-blue-subtle)",
          border: "var(--nr-accent-blue-border)",
          text: "var(--nr-accent-blue)",
          defaultIcon: <Info style={{ width: "18px", height: "18px" }} />,
          role: "status",
        };
    }
  };

  const config = getVariantConfig();

  return (
    <div
      role={config.role}
      className={`nr-alert nr-alert-${variant} ${className}`}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        padding: "0.875rem 1rem",
        borderRadius: "var(--nr-radius-md)",
        backgroundColor: config.bg,
        border: `1px solid ${config.border}`,
        color: "var(--nr-text-primary)",
        fontFamily: "var(--nr-font-sans)",
        position: "relative",
        ...style,
      }}
      {...props}
    >
      <span
        style={{
          color: config.text,
          flexShrink: 0,
          marginTop: "0.125rem",
          display: "inline-flex",
        }}
        aria-hidden="true"
      >
        {icon || config.defaultIcon}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <h4
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--nr-text-primary)",
              margin: "0 0 0.25rem",
              lineHeight: 1.3,
            }}
          >
            {title}
          </h4>
        )}
        {children && (
          <div
            style={{
              fontSize: "0.8125rem",
              color: "var(--nr-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            {children}
          </div>
        )}
        {action && <div style={{ marginTop: "0.625rem" }}>{action}</div>}
      </div>

      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss alert"
          onClick={onDismiss}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--nr-text-muted)",
            cursor: "pointer",
            padding: "0.25rem",
            borderRadius: "var(--nr-radius-sm)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "color var(--nr-transition-fast)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--nr-text-primary)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--nr-text-muted)";
          }}
        >
          <X style={{ width: "16px", height: "16px" }} />
        </button>
      )}
    </div>
  );
};

Alert.displayName = "Alert";

