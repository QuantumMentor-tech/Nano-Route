/**
//! Nano Route — Step 46 General Settings Panel
//! File: src/features/settings/components/GeneralSettingsPanel.tsx
//!
//! Exposes authoritative application-level user preferences from Step 20:
//! window startup state, local telemetry tracking, routing preference profile,
//! and virtual default reset.
*/

import React, { useState, useRef } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Maximize2,
  RefreshCw,
  Sliders,
  Sparkles,
  Download,
  Upload,
  Layout,
  PanelLeft,
  RotateCcw,
} from "lucide-react";
import {
  setAppSetting,
  type AppSettingsSnapshot,
  type RoutingPreferenceMode,
  type StartupRoutePreference,
} from "../../../services/ipc";
import { getRoutingProfileDescription } from "../settingsFormatters";
import { usePreferences } from "../PreferencesContext.tsx";

interface GeneralSettingsPanelProps {
  appSettings: AppSettingsSnapshot;
  onSettingsChanged: () => Promise<void>;
  onNavigateTab: (tabId: string) => void;
}

export const GeneralSettingsPanel: React.FC<GeneralSettingsPanelProps> = ({
  appSettings,
  onSettingsChanged,
  onNavigateTab,
}) => {
  const { exportPreferences, importPreferences, resetAll } = usePreferences();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleToggle = async (key: any, currentVal: boolean, label: string) => {
    try {
      setUpdatingKey(key);
      const nextVal = !currentVal;
      await setAppSetting(key, String(nextVal));
      await onSettingsChanged();
      setNotice(`Updated ${label}.`);
      setTimeout(() => setNotice(null), 3000);
    } catch (err: unknown) {
      setNotice(`Failed to update setting: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleStartupRouteChange = async (route: StartupRoutePreference) => {
    try {
      setUpdatingKey("workspace.startup_route");
      await setAppSetting("workspace.startup_route", route);
      await onSettingsChanged();
      setNotice(`Default startup route set to ${route.toUpperCase()}.`);
      setTimeout(() => setNotice(null), 3000);
    } catch (err: unknown) {
      setNotice(`Failed to set startup route: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleRoutingModeChange = async (mode: RoutingPreferenceMode) => {
    if (mode === appSettings.routingPreferenceMode) return;
    try {
      setUpdatingKey("routing.preference_mode");
      await setAppSetting("routing.preference_mode", mode);
      await onSettingsChanged();
      setNotice(`Routing profile switched to ${mode.toUpperCase()}.`);
      setTimeout(() => setNotice(null), 3000);
    } catch (err: unknown) {
      setNotice(`Failed to switch routing profile: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setUpdatingKey(null);
    }
  };

  const handleExportPreferences = () => {
    try {
      const json = exportPreferences();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nano-route-preferences-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setNotice("Exported user preferences to JSON file.");
      setTimeout(() => setNotice(null), 3000);
    } catch (err: unknown) {
      setNotice(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const res = await importPreferences(text);
      await onSettingsChanged();
      if (res.success) {
        setNotice(`Successfully imported ${res.appliedCount} preference settings.`);
      } else {
        setNotice(`Import failed: ${res.errors.join("; ")}`);
      }
      setTimeout(() => setNotice(null), 4000);
    } catch (err: unknown) {
      setNotice(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleResetDefaults = async () => {
    try {
      setResetting(true);
      await resetAll();
      await onSettingsChanged();
      setShowResetConfirm(false);
      setNotice("All user preferences safely reset to documented virtual defaults.");
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

      {/* Routing Preference Profile */}
      <section
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <Sparkles style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
            Routing Preference Profile
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", margin: "0 0 1rem 0" }}>
          Guides the multi-dimensional scoring engine when selecting candidate models during automatic routing.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
          {(["balanced", "quality", "cost_saving"] as RoutingPreferenceMode[]).map((mode) => {
            const isSelected = appSettings.routingPreferenceMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => handleRoutingModeChange(mode)}
                disabled={updatingKey === "routing.preference_mode"}
                style={{
                  textAlign: "left",
                  padding: "1rem",
                  borderRadius: "0.5rem",
                  background: isSelected ? "rgba(168, 85, 247, 0.15)" : "var(--nr-surface-raised)",
                  border: isSelected ? "1.5px solid var(--nr-accent-purple)" : "1px solid var(--nr-border-subtle)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                  <span
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                      color: isSelected ? "var(--nr-accent-purple)" : "var(--nr-text-primary)",
                      textTransform: "capitalize",
                    }}
                  >
                    {mode.replace("_", " ")}
                  </span>
                  {isSelected && (
                    <span
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.125rem 0.5rem",
                        borderRadius: "9999px",
                        background: "var(--nr-accent-purple)",
                        color: "#fff",
                        fontWeight: 600,
                      }}
                    >
                      Active
                    </span>
                  )}
                </div>
                <p style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", margin: 0, lineHeight: 1.4 }}>
                  {getRoutingProfileDescription(mode)}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Application Behavior Preferences */}
      <section
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <Sliders style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
            Application Behavior
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", margin: "0 0 1rem 0" }}>
          Configure desktop window lifecycle and local telemetry collection behavior.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Window start maximized toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Maximize2 style={{ width: "18px", height: "18px", color: "var(--nr-text-secondary)" }} />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--nr-text-primary)" }}>
                  Start Window Maximized
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
                  Launch Nano Route in a maximized desktop window state by default.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={appSettings.windowStartMaximized}
              aria-label="Start Window Maximized"
              disabled={updatingKey === "window.start_maximized"}
              onClick={() => handleToggle("window.start_maximized", appSettings.windowStartMaximized, "Start Window Maximized")}
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: appSettings.windowStartMaximized ? "var(--nr-accent-purple)" : "var(--nr-border-subtle)",
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
                  left: appSettings.windowStartMaximized ? "23px" : "3px",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>

          {/* Step 68: Restore Previous Workspace Session Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <RotateCcw style={{ width: "18px", height: "18px", color: "var(--nr-text-secondary)" }} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--nr-text-primary)" }}>
                    Restore Previous Workspace Session
                  </span>
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 600,
                      padding: "0.125rem 0.375rem",
                      borderRadius: "9999px",
                      background: appSettings.lastExitStatus === "unexpected_exit" ? "rgba(245, 158, 11, 0.15)" : "rgba(16, 185, 129, 0.15)",
                      color: appSettings.lastExitStatus === "unexpected_exit" ? "var(--nr-accent-warning, #f59e0b)" : "var(--nr-accent-success, #10b981)",
                    }}
                  >
                    {appSettings.lastExitStatus === "unexpected_exit" ? "Recovered Unexpected Exit" : "Clean Exit State"}
                  </span>
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
                  Re-opens your last visited navigation route and panel context when Nano Route launches.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={appSettings.restorePreviousSession ?? true}
              aria-label="Restore Previous Workspace Session"
              disabled={updatingKey === "workspace.restore_previous_session"}
              onClick={() => handleToggle("workspace.restore_previous_session", appSettings.restorePreviousSession ?? true, "Session Continuity")}
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: (appSettings.restorePreviousSession ?? true) ? "var(--nr-accent-purple)" : "var(--nr-border-subtle)",
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
                  left: (appSettings.restorePreviousSession ?? true) ? "23px" : "3px",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>

          {/* Local Telemetry Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Activity style={{ width: "18px", height: "18px", color: "var(--nr-text-secondary)" }} />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--nr-text-primary)" }}>
                  Local Operational Telemetry
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
                  Records execution latencies, token counts, and cost metrics strictly in local SQLite. Zero cloud reporting.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={appSettings.telemetryEnabled}
              aria-label="Enable Local Operational Telemetry"
              disabled={updatingKey === "telemetry.enabled"}
              onClick={() => handleToggle("telemetry.enabled", appSettings.telemetryEnabled, "Telemetry")}
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: appSettings.telemetryEnabled ? "var(--nr-accent-purple)" : "var(--nr-border-subtle)",
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
                  left: appSettings.telemetryEnabled ? "23px" : "3px",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Workspace & Navigation Behavior */}
      <section
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <Layout style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
            Workspace Startup & Navigation
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", margin: "0 0 1rem 0" }}>
          Configure initial application view on startup and navigation sidebar behavior.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Startup Route Selector */}
          <div
            style={{
              padding: "0.875rem 1rem",
              borderRadius: "0.5rem",
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
            }}
          >
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)", marginBottom: "0.25rem" }}>
              Initial Startup Destination
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginBottom: "0.75rem" }}>
              Select which workspace loads automatically when Nano Route boots up in normal state.
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => handleStartupRouteChange("overview")}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  background: (appSettings.startupRoute ?? "overview") === "overview" ? "var(--nr-accent-purple)" : "var(--nr-bg-surface)",
                  color: (appSettings.startupRoute ?? "overview") === "overview" ? "#fff" : "var(--nr-text-secondary)",
                  border: "1px solid var(--nr-border-subtle)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Dashboard Overview
              </button>
              <button
                type="button"
                onClick={() => handleStartupRouteChange("chat")}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  background: (appSettings.startupRoute ?? "overview") === "chat" ? "var(--nr-accent-purple)" : "var(--nr-bg-surface)",
                  color: (appSettings.startupRoute ?? "overview") === "chat" ? "#fff" : "var(--nr-text-secondary)",
                  border: "1px solid var(--nr-border-subtle)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Chat Workspace
              </button>
            </div>
          </div>

          {/* Sidebar Default State Toggle */}
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
              <PanelLeft style={{ width: "18px", height: "18px", color: "var(--nr-text-secondary)" }} />
              <div>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                  Collapse Sidebar by Default
                </div>
                <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
                  Start with the navigation sidebar collapsed into icon-only mode to increase main screen width.
                </div>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(appSettings.sidebarCollapsed)}
              aria-label="Collapse Sidebar by Default"
              disabled={updatingKey === "workspace.sidebar_collapsed"}
              onClick={() =>
                handleToggle(
                  "workspace.sidebar_collapsed",
                  Boolean(appSettings.sidebarCollapsed),
                  "Sidebar Default State"
                )
              }
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: appSettings.sidebarCollapsed ? "var(--nr-accent-purple)" : "var(--nr-border-subtle)",
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
                  left: appSettings.sidebarCollapsed ? "23px" : "3px",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Preferences Backup & Portability */}
      <section
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <Download style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
            Preferences Portability & Backup
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", margin: "0 0 1rem 0" }}>
          Export or import your non-sensitive presentation and behavior settings. <strong>API keys and credentials are never included.</strong>
        </p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleExportPreferences}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              background: "var(--nr-accent-purple)",
              color: "#fff",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Download style={{ width: "16px", height: "16px" }} />
            <span>Export Preferences (JSON)</span>
          </button>

          <label
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
            <Upload style={{ width: "16px", height: "16px" }} />
            <span>Import Preferences</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              style={{ display: "none" }}
            />
          </label>
        </div>
      </section>

      {/* Quick Link to Privacy & Retention Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1rem 1.25rem",
          borderRadius: "0.75rem",
          background: "rgba(59, 130, 246, 0.08)",
          border: "1px solid rgba(59, 130, 246, 0.2)",
        }}
      >
        <div>
          <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
            Data Lifecycle, Retention & Privacy Controls
          </div>
          <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem" }}>
            Configure automatic conversation and telemetry retention limits, run database integrity checks, or perform a Full Local Data Wipe.
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigateTab("privacy")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            background: "rgba(59, 130, 246, 0.2)",
            border: "1px solid rgba(59, 130, 246, 0.4)",
            color: "#60a5fa",
            fontSize: "0.875rem",
            fontWeight: 500,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <span>Open Privacy Controls</span>
          <ArrowRight style={{ width: "16px", height: "16px" }} />
        </button>
      </div>

      {/* Reset Application Settings (Danger Zone) */}
      <section
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <AlertTriangle style={{ width: "20px", height: "20px", color: "#f87171" }} />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
            Reset Application Settings
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", margin: "0 0 1rem 0" }}>
          Restores documented defaults for window behavior, local telemetry collection, and routing mode.
          <strong> This does NOT delete API credentials, conversation history, or telemetry records.</strong>
        </p>

        {!showResetConfirm ? (
          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              background: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#f87171",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reset Application Settings to Defaults
          </button>
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            <span style={{ fontSize: "0.875rem", color: "var(--nr-text-primary)", flex: 1 }}>
              Are you sure? This will revert routing mode to Balanced and window settings to default.
            </span>
            <button
              type="button"
              onClick={handleResetDefaults}
              disabled={resetting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                background: "#dc2626",
                border: "none",
                color: "#fff",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {resetting && <RefreshCw style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />}
              <span>Confirm Reset</span>
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
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

