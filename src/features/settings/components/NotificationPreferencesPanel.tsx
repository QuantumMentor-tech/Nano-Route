/**
 * Nano Route — Step 66 Notification Preferences Panel
 * File: src/features/settings/components/NotificationPreferencesPanel.tsx
 *
 * Exposes non-critical toast suppression, toast duration configuration,
 * and integration with Step 64 Unified Notification Center.
 */

import React, { useState } from "react";
import {
  Bell,
  Clock,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Send,
} from "lucide-react";
import { type AppSettingsSnapshot } from "../../../services/ipc";
import { useNotifications } from "../../notifications";
import { usePreferences } from "../PreferencesContext.tsx";

interface NotificationPreferencesPanelProps {
  appSettings: AppSettingsSnapshot;
  onSettingsChanged: () => Promise<void>;
}

export const NotificationPreferencesPanel: React.FC<NotificationPreferencesPanelProps> = ({
  appSettings,
  onSettingsChanged,
}) => {
  const { updatePreference, resetSection } = usePreferences();
  const { publish } = useNotifications();
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleToggle = async (key: any, currentVal: boolean, label: string) => {
    try {
      setUpdatingKey(key);
      const nextVal = !currentVal;
      await updatePreference(key, String(nextVal));
      await onSettingsChanged();
      setNotice(`Updated ${label}.`);
      setTimeout(() => setNotice(null), 3000);
    } catch (err: unknown) {
      setNotice(`Failed to update ${label}: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleDurationChange = async (durationMs: number) => {
    try {
      setUpdatingKey("notifications.toast_duration_ms");
      await updatePreference("notifications.toast_duration_ms", String(durationMs));
      await onSettingsChanged();
      setNotice(`Toast duration set to ${durationMs / 1000} seconds.`);
      setTimeout(() => setNotice(null), 3000);
    } catch (err: unknown) {
      setNotice(`Failed to update duration: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleTestToast = () => {
    publish({
      title: "Test Notification",
      message: "This is a preview notification honoring your configured duration and appearance preferences.",
      severity: "info",
      source: "Settings",
    });
  };

  const handleResetSection = async () => {
    try {
      setResetting(true);
      await resetSection("notifications");
      await onSettingsChanged();
      setShowResetConfirm(false);
      setNotice("Notification preferences restored to defaults.");
      setTimeout(() => setNotice(null), 3500);
    } catch (err: unknown) {
      setNotice(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResetting(false);
    }
  };

  const durationOptions = [
    { ms: 3000, label: "3 Seconds (Fast)" },
    { ms: 5000, label: "5 Seconds (Default)" },
    { ms: 8000, label: "8 Seconds (Extended)" },
    { ms: 12000, label: "12 Seconds (Long)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {notice && (
        <div
          role="status"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1rem",
            borderRadius: "0.5rem",
            background: "rgba(168, 85, 247, 0.12)",
            border: "1px solid rgba(168, 85, 247, 0.3)",
            color: "var(--nr-text-primary)",
            fontSize: "0.875rem",
          }}
        >
          <CheckCircle2 style={{ width: "16px", height: "16px", color: "var(--nr-accent-purple)" }} />
          <span>{notice}</span>
        </div>
      )}

      {/* Notification Preferences */}
      <section
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <Bell style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
            Notification Display & Timing
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", margin: "0 0 1rem 0" }}>
          Controls pop-up toast presentation. Security notices, recovery requirements, and system errors are never suppressed.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Non-Critical Toast Suppression */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.875rem 1rem",
              borderRadius: "0.5rem",
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
            }}
          >
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                Enable Non-Critical Toast Notifications
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginTop: "0.15rem" }}>
                Displays transient popups for routine success and informational messages. When disabled, messages are quietly added to the Notification Center without interrupting your focus.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={appSettings.notificationEnableNonCriticalToasts ?? true}
              aria-label="Enable Non-Critical Toast Notifications"
              disabled={updatingKey === "notifications.enable_non_critical_toasts"}
              onClick={() =>
                handleToggle(
                  "notifications.enable_non_critical_toasts",
                  appSettings.notificationEnableNonCriticalToasts ?? true,
                  "Non-Critical Toasts"
                )
              }
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: (appSettings.notificationEnableNonCriticalToasts ?? true)
                  ? "var(--nr-accent-purple)"
                  : "var(--nr-border-subtle)",
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s ease",
              }}
            >
              <div
                style={{
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  background: "#fff",
                  position: "absolute",
                  top: "3px",
                  left: (appSettings.notificationEnableNonCriticalToasts ?? true) ? "23px" : "3px",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>

          {/* Toast Duration */}
          <div
            style={{
              padding: "0.875rem 1rem",
              borderRadius: "0.5rem",
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <Clock style={{ width: "16px", height: "16px", color: "var(--nr-text-secondary)" }} />
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                Toast Display Duration
              </div>
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginBottom: "0.75rem" }}>
              How long transient toast messages remain visible on screen before auto-dismissing.
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {durationOptions.map((opt) => {
                const isSelected = (appSettings.notificationToastDurationMs ?? 5000) === opt.ms;
                return (
                  <button
                    key={opt.ms}
                    type="button"
                    onClick={() => handleDurationChange(opt.ms)}
                    disabled={updatingKey === "notifications.toast_duration_ms"}
                    style={{
                      padding: "0.5rem 0.875rem",
                      borderRadius: "0.375rem",
                      background: isSelected ? "var(--nr-accent-purple)" : "var(--nr-bg-surface)",
                      color: isSelected ? "#fff" : "var(--nr-text-secondary)",
                      border: "1px solid var(--nr-border-subtle)",
                      fontSize: "0.8125rem",
                      fontWeight: isSelected ? 600 : 500,
                      cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Test Toast Trigger */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.875rem 1rem",
              borderRadius: "0.5rem",
              background: "rgba(168, 85, 247, 0.08)",
              border: "1px solid rgba(168, 85, 247, 0.2)",
            }}
          >
            <div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                Test Notification Toast
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
                Trigger a preview toast to evaluate current timing and contrast styling.
              </div>
            </div>
            <button
              type="button"
              onClick={handleTestToast}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0.875rem",
                borderRadius: "0.375rem",
                background: "var(--nr-accent-purple)",
                color: "#fff",
                border: "none",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Send style={{ width: "14px", height: "14px" }} />
              <span>Send Preview Toast</span>
            </button>
          </div>
        </div>
      </section>

      {/* Safety Invariant Notice */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          padding: "1rem",
          borderRadius: "0.5rem",
          background: "rgba(16, 185, 129, 0.08)",
          border: "1px solid rgba(16, 185, 129, 0.25)",
        }}
      >
        <ShieldCheck style={{ width: "20px", height: "20px", color: "#34d399", flexShrink: 0, marginTop: "2px" }} />
        <div>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
            Safety & Non-Suppression Guarantee
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem", lineHeight: 1.4 }}>
            Disaster recovery alerts, database corruption warnings, credential expiration warnings, and update integrity notices are classified as high-priority and will always display regardless of toast suppression settings.
          </div>
        </div>
      </div>

      {/* Reset Notification Preferences Section */}
      <section
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
              Reset Notification Preferences
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem" }}>
              Restores toast suppression and duration settings to documented virtual defaults.
            </div>
          </div>

          {!showResetConfirm ? (
            <button
              type="button"
              onClick={() => setShowResetConfirm(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                background: "transparent",
                border: "1px solid var(--nr-border-subtle)",
                color: "var(--nr-text-primary)",
                fontSize: "0.875rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <RefreshCw style={{ width: "14px", height: "14px" }} />
              <span>Reset Notification Preferences</span>
            </button>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={handleResetSection}
                disabled={resetting}
                style={{
                  padding: "0.5rem 0.875rem",
                  borderRadius: "0.375rem",
                  background: "var(--nr-accent-purple)",
                  border: "none",
                  color: "#fff",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {resetting ? "Resetting..." : "Confirm Reset"}
              </button>
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                style={{
                  padding: "0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  background: "transparent",
                  border: "1px solid var(--nr-border-subtle)",
                  color: "var(--nr-text-secondary)",
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

