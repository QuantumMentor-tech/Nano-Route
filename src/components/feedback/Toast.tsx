import React, { useEffect, useState, useRef } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import type { ToastItem } from "./ToastContext";

export interface ToastProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isPaused || toast.durationMs === 0) return;

    timerRef.current = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.durationMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPaused, toast.id, toast.durationMs, onDismiss]);

  const getVariantStyles = () => {
    switch (toast.variant) {
      case "success":
        return {
          icon: <CheckCircle2 style={{ width: "18px", height: "18px", color: "var(--nr-status-success)" }} />,
          borderLeft: "3px solid var(--nr-status-success)",
        };
      case "error":
        return {
          icon: <AlertCircle style={{ width: "18px", height: "18px", color: "var(--nr-status-error)" }} />,
          borderLeft: "3px solid var(--nr-status-error)",
        };
      case "warning":
        return {
          icon: <AlertTriangle style={{ width: "18px", height: "18px", color: "var(--nr-status-warning)" }} />,
          borderLeft: "3px solid var(--nr-status-warning)",
        };
      case "info":
      default:
        return {
          icon: <Info style={{ width: "18px", height: "18px", color: "var(--nr-accent-blue)" }} />,
          borderLeft: "3px solid var(--nr-accent-blue)",
        };
    }
  };

  const variantStyle = getVariantStyles();

  return (
    <div
      role={toast.variant === "error" ? "alert" : "status"}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0.75rem",
        minWidth: "280px",
        maxWidth: "380px",
        padding: "0.875rem 1rem",
        backgroundColor: "var(--nr-bg-surface-overlay)",
        border: "1px solid var(--nr-border-strong)",
        borderRadius: "var(--nr-radius-md)",
        boxShadow: "var(--nr-shadow-lg)",
        color: "var(--nr-text-primary)",
        fontFamily: "var(--nr-font-sans)",
        pointerEvents: "auto",
        transition: "all var(--nr-transition-fast)",
        ...variantStyle,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: "0.125rem", display: "inline-flex" }}>
        {variantStyle.icon}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        {toast.title && (
          <h5
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--nr-text-primary)",
              margin: "0 0 0.125rem",
              lineHeight: 1.3,
            }}
          >
            {toast.title}
          </h5>
        )}
        <p
          style={{
            fontSize: "0.8125rem",
            color: "var(--nr-text-secondary)",
            margin: 0,
            lineHeight: 1.4,
            wordBreak: "break-word",
          }}
        >
          {toast.message}
        </p>
      </div>

      <button
        type="button"
        aria-label="Close notification"
        onClick={() => onDismiss(toast.id)}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--nr-text-muted)",
          cursor: "pointer",
          padding: "0.125rem",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          borderRadius: "var(--nr-radius-sm)",
          transition: "color var(--nr-transition-fast)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "var(--nr-text-primary)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "var(--nr-text-muted)";
        }}
      >
        <X style={{ width: "14px", height: "14px" }} />
      </button>
    </div>
  );
};

Toast.displayName = "Toast";

