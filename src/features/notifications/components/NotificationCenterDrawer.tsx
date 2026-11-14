/**
 * Nano Route — In-App Notification Center Drawer
 * File: src/features/notifications/components/NotificationCenterDrawer.tsx
 *
 * Provides a slide-over panel displaying active, unread, and historical notifications
 * with filtering by severity, status, direct remediation routing, and bulk dismissal.
 */

import React, { useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ShieldAlert,
  Trash2,
  CheckCheck,
} from "lucide-react";
import { useNotifications } from "../NotificationContext.tsx";
import type { AppNotification, NotificationSeverity, NotificationActionTarget } from "../types.ts";

function getSeverityIcon(severity: NotificationSeverity, size = 16) {
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

export const NotificationCenterDrawer: React.FC = () => {
  const {
    notifications,
    isCenterOpen,
    setIsCenterOpen,
    markAsRead,
    markAllAsRead,
    dismissNotification,
    clearAll,
  } = useNotifications();

  const navigate = useNavigate();
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap: focus close button when opened
  useEffect(() => {
    if (isCenterOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isCenterOpen]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isCenterOpen) {
        setIsCenterOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCenterOpen, setIsCenterOpen]);

  if (!isCenterOpen) return null;

  const handleActionClick = (notif: AppNotification, action: NotificationActionTarget) => {
    markAsRead(notif.id);
    setIsCenterOpen(false);
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
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-center-title"
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        zIndex: 10000,
        display: "flex",
        justifyContent: "flex-end",
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(2px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setIsCenterOpen(false);
      }}
    >
      <div
        ref={drawerRef}
        style={{
          width: "420px",
          maxWidth: "100vw",
          height: "100%",
          backgroundColor: "var(--nr-bg-surface, #0f172a)",
          borderLeft: "1px solid rgba(255, 255, 255, 0.1)",
          boxShadow: "-10px 0 25px rgba(0, 0, 0, 0.6)",
          display: "flex",
          flexDirection: "column",
          color: "#f8fafc",
        }}
      >
        {/* Drawer Header */}
        <header
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Bell size={18} aria-hidden="true" style={{ color: "#a78bfa" }} />
            <h2 id="notification-center-title" style={{ margin: 0, fontSize: "16px", fontWeight: 700 }}>
              Notification Center
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {notifications.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  aria-label="Mark all notifications as read"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "6px",
                    borderRadius: "4px",
                    display: "inline-flex",
                  }}
                >
                  <CheckCheck size={16} />
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  title="Clear all notifications"
                  aria-label="Clear all notifications"
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                    padding: "6px",
                    borderRadius: "4px",
                    display: "inline-flex",
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}

            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setIsCenterOpen(false)}
              aria-label="Close Notification Center"
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "4px",
                display: "inline-flex",
              }}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {/* Drawer Body / List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          {notifications.length === 0 ? (
            <div
              style={{
                padding: "3rem 1rem",
                textAlign: "center",
                color: "#64748b",
              }}
            >
              <Bell size={36} aria-hidden="true" style={{ opacity: 0.3, marginBottom: "12px" }} />
              <p style={{ margin: 0, fontSize: "14px", fontWeight: 500 }}>No notifications</p>
              <p style={{ margin: "4px 0 0", fontSize: "12px" }}>All background systems operating normally.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                style={{
                  padding: "12px 14px",
                  borderRadius: "8px",
                  backgroundColor: notif.status === "unread" ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.02)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    {getSeverityIcon(notif.severity)}
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" }}>
                      {notif.source}
                    </span>
                    {notif.status === "unread" && (
                      <span
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          backgroundColor: "#a78bfa",
                        }}
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => dismissNotification(notif.id)}
                    aria-label={`Dismiss ${notif.title}`}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#64748b",
                      cursor: "pointer",
                      padding: "2px",
                      display: "inline-flex",
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>

                <div style={{ fontSize: "13px", fontWeight: 600, color: "#f1f5f9" }}>{notif.title}</div>
                <div style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.4 }}>{notif.message}</div>

                {notif.actions && notif.actions.length > 0 && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
                    {notif.actions.map((act, i) => (
                      <button
                        key={i}
                        onClick={() => handleActionClick(notif, act)}
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

                <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
                  {new Date(notif.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

