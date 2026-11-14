/**
 * Nano Route — Step 66 Chat Settings Panel
 * File: src/features/settings/components/ChatSettingsPanel.tsx
 *
 * Exposes chat presentation, message timestamp visibility, message spacing,
 * send keyboard shortcut behavior, auto-scroll behavior, and clear-chat confirmations.
 */

import React, { useState } from "react";
import {
  MessageSquare,
  Clock,
  CornerDownLeft,
  ArrowDownCircle,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { type AppSettingsSnapshot } from "../../../services/ipc";
import { usePreferences } from "../PreferencesContext.tsx";

interface ChatSettingsPanelProps {
  appSettings: AppSettingsSnapshot;
  onSettingsChanged: () => Promise<void>;
}

export const ChatSettingsPanel: React.FC<ChatSettingsPanelProps> = ({
  appSettings,
  onSettingsChanged,
}) => {
  const { updatePreference, resetSection } = usePreferences();
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

  const handleResetSection = async () => {
    try {
      setResetting(true);
      await resetSection("chat");
      await onSettingsChanged();
      setShowResetConfirm(false);
      setNotice("Chat preferences restored to defaults.");
      setTimeout(() => setNotice(null), 3500);
    } catch (err: unknown) {
      setNotice(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResetting(false);
    }
  };

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

      {/* Chat Workspace Presentation */}
      <section
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <MessageSquare style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
            Chat Presentation & Behavior
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", margin: "0 0 1rem 0" }}>
          Customize how messages and conversation streams are rendered in the Chat workspace.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Show Timestamps */}
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Clock style={{ width: "18px", height: "18px", color: "var(--nr-text-secondary)" }} />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                  Show Message Timestamps
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
                  Displays exact local dispatch and arrival timestamps next to each message bubble.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(appSettings.chatShowTimestamps)}
              aria-label="Show Message Timestamps"
              disabled={updatingKey === "chat.show_timestamps"}
              onClick={() =>
                handleToggle(
                  "chat.show_timestamps",
                  Boolean(appSettings.chatShowTimestamps),
                  "Message Timestamps"
                )
              }
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: appSettings.chatShowTimestamps ? "var(--nr-accent-purple)" : "var(--nr-border-subtle)",
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
                  left: appSettings.chatShowTimestamps ? "23px" : "3px",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>

          {/* Compact Message Spacing */}
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Sparkles style={{ width: "18px", height: "18px", color: "var(--nr-text-secondary)" }} />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                  Compact Message Spacing
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
                  Reduces vertical padding between consecutive message bubbles to display more turns on screen.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(appSettings.chatCompactSpacing)}
              aria-label="Compact Message Spacing"
              disabled={updatingKey === "chat.compact_spacing"}
              onClick={() =>
                handleToggle(
                  "chat.compact_spacing",
                  Boolean(appSettings.chatCompactSpacing),
                  "Compact Spacing"
                )
              }
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: appSettings.chatCompactSpacing ? "var(--nr-accent-purple)" : "var(--nr-border-subtle)",
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
                  left: appSettings.chatCompactSpacing ? "23px" : "3px",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>

          {/* Send Keyboard Shortcut (Enter vs Ctrl+Enter) */}
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <CornerDownLeft style={{ width: "18px", height: "18px", color: "var(--nr-text-secondary)" }} />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                  Enter Key Sends Message
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
                  When enabled, pressing <kbd style={{ padding: "0.1rem 0.3rem", borderRadius: "3px", background: "var(--nr-border-default)", fontSize: "0.75rem" }}>Enter</kbd> sends the message and <kbd style={{ padding: "0.1rem 0.3rem", borderRadius: "3px", background: "var(--nr-border-default)", fontSize: "0.75rem" }}>Shift+Enter</kbd> adds a new line. When disabled, <kbd style={{ padding: "0.1rem 0.3rem", borderRadius: "3px", background: "var(--nr-border-default)", fontSize: "0.75rem" }}>Ctrl+Enter</kbd> sends.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={appSettings.chatEnterToSend ?? true}
              aria-label="Enter Key Sends Message"
              disabled={updatingKey === "chat.enter_to_send"}
              onClick={() =>
                handleToggle(
                  "chat.enter_to_send",
                  appSettings.chatEnterToSend ?? true,
                  "Send Key Shortcut"
                )
              }
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: (appSettings.chatEnterToSend ?? true) ? "var(--nr-accent-purple)" : "var(--nr-border-subtle)",
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
                  left: (appSettings.chatEnterToSend ?? true) ? "23px" : "3px",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>

          {/* Auto-scroll to newest message during streaming */}
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <ArrowDownCircle style={{ width: "18px", height: "18px", color: "var(--nr-text-secondary)" }} />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                  Auto-Scroll to Newest Output
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
                  Automatically scrolls down as assistant tokens stream in. User manual scroll position is preserved.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={appSettings.chatAutoScroll ?? true}
              aria-label="Auto-Scroll to Newest Output"
              disabled={updatingKey === "chat.auto_scroll_to_bottom"}
              onClick={() =>
                handleToggle(
                  "chat.auto_scroll_to_bottom",
                  appSettings.chatAutoScroll ?? true,
                  "Auto-Scroll"
                )
              }
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: (appSettings.chatAutoScroll ?? true) ? "var(--nr-accent-purple)" : "var(--nr-border-subtle)",
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
                  left: (appSettings.chatAutoScroll ?? true) ? "23px" : "3px",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>

          {/* Confirm Before Clearing Chat */}
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <AlertCircle style={{ width: "18px", height: "18px", color: "var(--nr-text-secondary)" }} />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                  Confirm Before Clearing Chat
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
                  Displays a confirmation prompt when clearing the active chat session to prevent accidental loss.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={appSettings.confirmChatClear ?? true}
              aria-label="Confirm Before Clearing Chat"
              disabled={updatingKey === "workspace.confirm_chat_clear"}
              onClick={() =>
                handleToggle(
                  "workspace.confirm_chat_clear",
                  appSettings.confirmChatClear ?? true,
                  "Clear Confirmation"
                )
              }
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: (appSettings.confirmChatClear ?? true) ? "var(--nr-accent-purple)" : "var(--nr-border-subtle)",
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
                  left: (appSettings.confirmChatClear ?? true) ? "23px" : "3px",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Reset Chat Preferences Section */}
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
              Reset Chat Preferences
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem" }}>
              Restores timestamps, spacing, keyboard shortcuts, and scrolling to documented virtual defaults.
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
              <span>Reset Chat Preferences</span>
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

