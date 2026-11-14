/**
 * Nano Route — Unified Toast & Transient Alert Renderer
 * File: src/features/notifications/components/UnifiedToastContainer.tsx
 *
 * Implements accessible, non-blocking toast stacks, timed auto-dismissal,
 * pause on hover, keyboard focus, and WCAG live region status announcements.
 */

import React, { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  ShieldAlert,
} from "lucide-react";
import { useNotifications } from "../NotificationContext.tsx";
import type { AppNotification, NotificationSeverity, NotificationActionTarget } from "../types.ts";

function getSeverityIcon(severity: NotificationSeverity, size = 18) {
  const props = { size, ariaHidden: "true", className: "flex-shrink-0" };
  switch (severity) {
    case "success":
      return <CheckCircle2 {...props} style={{ color: "#4ade80" }} />;
    case "warning":
      return <AlertTriangle {...props} style={{ color: "#facc15" }} />;
    case "error":
      return <AlertCircle {...props} style={{ color: "#f87171" }} />;
    case "critical":
      return <ShieldAlert {...props} style={{ color: "#ef4444" }} />;
    case "info":
    default:
      return <Info {...props} style={{ color: "#60a5fa" }} />;
  }
}

function getSeverityBadgeStyle(severity: NotificationSeverity): React.CSSProperties {
  switch (severity) {
    case "success":
      return { borderLeft: "4px solid #4ade80", background: "rgba(15, 23, 42, 0.95)" };
    case "warning":
      return { borderLeft: "4px solid #facc15", background: "rgba(15, 23, 42, 0.95)" };
    case "error":
      return { borderLeft: "4px solid #f87171", background: "rgba(15, 23, 42, 0.95)" };
    case "critical":
      return { borderLeft: "4px solid #ef4444", background: "rgba(24, 10, 10, 0.98)" };
    case "info":
    default:
      return { borderLeft: "4px solid #60a5fa", background: "rgba(15, 23, 42, 0.95)" };
  }
}

interface ToastItemProps {
  notification: AppNotification;
  onDismiss: (id: string) => void;
  onActionClick: (action: NotificationActionTarget) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ notification, onDismiss, onActionClick }) => {
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (notification.durationMs && notification.durationMs > 0) {
      timerRef.current = setTimeout(() => {
        onDismiss(notification.id);
      }, notification.durationMs);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [notification.id, notification.durationMs, onDismiss]);

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleMouseLeave = () => {
    if (notification.durationMs && notification.durationMs > 0) {
      timerRef.current = setTimeout(() => {
        onDismiss(notification.id);
      }, notification.durationMs);
    }
  };

  return (
    <div
      role={notification.severity === "critical" || notification.severity === "error" ? "alert" : "status"}
      aria-live={notification.severity === "critical" ? "assertive" : "polite"}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        padding: "12px 14px",
        borderRadius: "8px",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)",
        color: "#f8fafc",
        width: "360px",
        maxWidth: "calc(100vw - 32px)",
        pointerEvents: "auto",
        transition: "all 0.2s ease-in-out",
        ...getSeverityBadgeStyle(notification.severity),
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {getSeverityIcon(notification.severity)}
          <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#94a3b8" }}>
            {notification.source}
          </span>
          {notification.occurrenceCount > 1 && (
            <span
              style={{
                fontSize: "10px",
                padding: "1px 5px",
                borderRadius: "10px",
                background: "rgba(255, 255, 255, 0.1)",
                color: "#e2e8f0",
              }}
            >
              ×{notification.occurrenceCount}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(notification.id)}
          aria-label={`Dismiss notification: ${notification.title}`}
          style={{
            background: "transparent",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            padding: "2px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "4px",
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <div style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9" }}>{notification.title}</div>
      <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.4 }}>{notification.message}</div>

      {notification.actions && notification.actions.length > 0 && (
        <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
          {notification.actions.map((act, i) => (
            <button
              key={i}
              onClick={() => onActionClick(act)}
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 600,
                borderRadius: "4px",
                background: "rgba(167, 139, 250, 0.15)",
                border: "1px solid rgba(167, 139, 250, 0.35)",
                color: "#c084fc",
                cursor: "pointer",
              }}
            >
              {act.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const UnifiedToastContainer: React.FC = () => {
  const { activeToasts, dismissToast } = useNotifications();
  const navigate = useNavigate();

  const handleActionClick = (action: NotificationActionTarget) => {
    if (action.type === "route") {
      navigate(action.path);
    } else if (action.type === "diagnostic") {
      navigate("/diagnostics");
    } else if (action.type === "help") {
      navigate(action.articleId ? `/help?article=${action.articleId}` : "/help");
    }
  };

  if (activeToasts.length === 0) return null;

  return (
    <aside
      aria-label="Active notifications"
      style={{
        position: "fixed",
        bottom: "20px",
        right: "20px",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        pointerEvents: "none",
      }}
    >
      {activeToasts.map((notif) => (
        <ToastItem
          key={notif.id}
          notification={notif}
          onDismiss={dismissToast}
          onActionClick={handleActionClick}
        />
      ))}
    </aside>
  );
};

