/**
 * Nano Route — System Status Banner Component
 * File: src/features/notifications/components/SystemStatusBanner.tsx
 *
 * Renders persistent top-level warnings or critical notices (e.g. Degraded routing,
 * Recovery required, Database lock) directly in the application shell.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, AlertCircle, ShieldAlert, X } from "lucide-react";
import { useNotifications } from "../NotificationContext.tsx";
import type { NotificationActionTarget, NotificationSeverity } from "../types.ts";

function getBannerIcon(severity: NotificationSeverity) {
  switch (severity) {
    case "critical":
      return <ShieldAlert size={16} style={{ color: "#ef4444" }} />;
    case "error":
      return <AlertCircle size={16} style={{ color: "#f87171" }} />;
    case "warning":
    default:
      return <AlertTriangle size={16} style={{ color: "#facc15" }} />;
  }
}

export const SystemStatusBanner: React.FC = () => {
  const { notifications, dismissNotification } = useNotifications();
  const navigate = useNavigate();

  // Find the highest severity active banner notification
  const activeBanner = notifications.find(
    (n) =>
      n.delivery === "banner" &&
      n.status !== "dismissed" &&
      n.status !== "resolved" &&
      (n.severity === "critical" || n.severity === "error" || n.severity === "warning")
  );

  if (!activeBanner) return null;

  const handleActionClick = (action: NotificationActionTarget) => {
    if (action.type === "route") {
      navigate(action.path);
    } else if (action.type === "diagnostic") {
      navigate("/diagnostics");
    } else if (action.type === "help") {
      navigate(action.articleId ? `/help?article=${action.articleId}` : "/help");
    }
  };

  return (
    <div
      role="alert"
      style={{
        width: "100%",
        padding: "8px 16px",
        backgroundColor: activeBanner.severity === "critical" ? "rgba(185, 28, 28, 0.9)" : "rgba(120, 53, 15, 0.9)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        fontSize: "12px",
        fontWeight: 500,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
        {getBannerIcon(activeBanner.severity)}
        <span>
          <strong>{activeBanner.title}:</strong> {activeBanner.message}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        {activeBanner.actions?.map((act, i) => (
          <button
            key={i}
            onClick={() => handleActionClick(act)}
            style={{
              padding: "3px 8px",
              background: "rgba(255, 255, 255, 0.2)",
              border: "1px solid rgba(255, 255, 255, 0.4)",
              borderRadius: "4px",
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {act.label}
          </button>
        ))}

        <button
          type="button"
          onClick={() => dismissNotification(activeBanner.id)}
          aria-label="Dismiss banner"
          style={{
            background: "none",
            border: "none",
            color: "rgba(255, 255, 255, 0.7)",
            cursor: "pointer",
            padding: "2px",
            display: "inline-flex",
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

