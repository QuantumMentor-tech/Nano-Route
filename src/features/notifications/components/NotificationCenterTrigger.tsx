/**
 * Nano Route — Notification Trigger & Bell Button
 * File: src/features/notifications/components/NotificationCenterTrigger.tsx
 *
 * Renders a header/navigation bell icon with unread count indicator
 * to open the Notification Center Drawer.
 */

import React from "react";
import { Bell } from "lucide-react";
import { useNotifications } from "../NotificationContext.tsx";

export const NotificationCenterTrigger: React.FC<{ className?: string }> = ({ className = "" }) => {
  const { unreadCount, setIsCenterOpen } = useNotifications();

  return (
    <button
      type="button"
      onClick={() => setIsCenterOpen(true)}
      aria-label={`Open Notifications (${unreadCount} unread)`}
      className={`nr-notification-trigger ${className}`}
      style={{
        position: "relative",
        background: "transparent",
        border: "none",
        color: unreadCount > 0 ? "var(--nr-accent-purple, #a78bfa)" : "var(--nr-text-secondary, #94a3b8)",
        cursor: "pointer",
        padding: "6px",
        borderRadius: "6px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "color 0.15s ease",
      }}
    >
      <Bell size={18} aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          style={{
            position: "absolute",
            top: "2px",
            right: "2px",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: "#ef4444",
            border: "2px solid #0f172a",
          }}
          aria-hidden="true"
        />
      )}
    </button>
  );
};

