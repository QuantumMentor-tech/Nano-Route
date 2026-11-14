/**
 * Nano Route — Step 66 Appearance Settings Panel
 * File: src/features/settings/components/AppearanceSettingsPanel.tsx
 *
 * Exposes user-configurable theme mode, interface density, reduced motion,
 * text scaling, and high-visibility focus indicators.
 */

import React, { useState } from "react";
import {
  Palette,
  Sun,
  Moon,
  Laptop,
  CheckCircle2,
  Sparkles,
  Eye,
  Type,
  Maximize2,
  Minimize2,
  RefreshCw,
} from "lucide-react";
import {
  type AppSettingsSnapshot,
  type ThemeMode,
  type InterfaceDensity,
  type MotionPreference,
  type TextScalePreference,
} from "../../../services/ipc";
import { usePreferences } from "../PreferencesContext.tsx";

interface AppearanceSettingsPanelProps {
  appSettings: AppSettingsSnapshot;
  onSettingsChanged: () => Promise<void>;
}

export const AppearanceSettingsPanel: React.FC<AppearanceSettingsPanelProps> = ({
  appSettings,
  onSettingsChanged,
}) => {
  const { updatePreference, resetSection } = usePreferences();
  const [updatingKey, setUpdatingKey] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleUpdate = async (key: any, val: string, label: string) => {
    try {
      setUpdatingKey(key);
      await updatePreference(key, val);
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
      await resetSection("appearance");
      await onSettingsChanged();
      setShowResetConfirm(false);
      setNotice("Appearance settings restored to defaults.");
      setTimeout(() => setNotice(null), 3500);
    } catch (err: unknown) {
      setNotice(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResetting(false);
    }
  };

  const themeOptions: Array<{ id: ThemeMode; label: string; desc: string; icon: React.ReactNode }> = [
    {
      id: "dark",
      label: "Dark (Default)",
      desc: "Optimized for low-light environments with high-contrast surfaces (#09090b).",
      icon: <Moon style={{ width: "18px", height: "18px" }} />,
    },
    {
      id: "light",
      label: "Light",
      desc: "Clean light canvas with crisp high-contrast text (#0f172a).",
      icon: <Sun style={{ width: "18px", height: "18px" }} />,
    },
    {
      id: "system",
      label: "System",
      desc: "Synchronizes automatically with your Windows OS color scheme preference.",
      icon: <Laptop style={{ width: "18px", height: "18px" }} />,
    },
  ];

  const densityOptions: Array<{ id: InterfaceDensity; label: string; desc: string; icon: React.ReactNode }> = [
    {
      id: "comfortable",
      label: "Comfortable (Default)",
      desc: "Spacious padding, accessible touch targets, and relaxed reading rhythm.",
      icon: <Maximize2 style={{ width: "18px", height: "18px" }} />,
    },
    {
      id: "compact",
      label: "Compact",
      desc: "Denser spacing maximizing visible screen real-estate for power users.",
      icon: <Minimize2 style={{ width: "18px", height: "18px" }} />,
    },
  ];

  const motionOptions: Array<{ id: MotionPreference; label: string; desc: string }> = [
    { id: "system", label: "System Default", desc: "Adheres to Windows accessibility animation settings." },
    { id: "reduced", label: "Reduced Motion", desc: "Suppresses transitions and UI animations to avoid disorientation." },
    { id: "standard", label: "Standard Motion", desc: "Enables smooth micro-interactions and transitions." },
  ];

  const textScaleOptions: Array<{ id: TextScalePreference; label: string }> = [
    { id: "100%", label: "100% (Standard)" },
    { id: "110%", label: "110% (Medium)" },
    { id: "125%", label: "125% (Large)" },
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

      {/* Theme Selection */}
      <section
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <Palette style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
            Color Theme
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", margin: "0 0 1rem 0" }}>
          Choose your desktop appearance theme. Contrast strictly meets WCAG 2.1 AA specifications across all modes.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
          {themeOptions.map((opt) => {
            const isSelected = (appSettings.themeMode ?? "dark") === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleUpdate("appearance.theme_mode", opt.id, "Theme")}
                disabled={updatingKey === "appearance.theme_mode"}
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
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {opt.icon}
                    <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                      {opt.label}
                    </span>
                  </div>
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
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Interface Density */}
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
            Interface Density
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", margin: "0 0 1rem 0" }}>
          Adjust the visual padding and component scale. Compact mode preserves minimum 44px hit-targets where required.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.75rem" }}>
          {densityOptions.map((opt) => {
            const isSelected = (appSettings.density ?? "comfortable") === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleUpdate("appearance.density", opt.id, "Density")}
                disabled={updatingKey === "appearance.density"}
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
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {opt.icon}
                    <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                      {opt.label}
                    </span>
                  </div>
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
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Reduced Motion & Text Scale (Accessibility Oriented) */}
      <section
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <Eye style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
            Motion & Accessibility Display
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", margin: "0 0 1rem 0" }}>
          Configure motion ergonomics, font scaling, and enhanced focus indicators.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Reduced Motion Setting */}
          <div
            style={{
              padding: "0.875rem 1rem",
              borderRadius: "0.5rem",
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
            }}
          >
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)", marginBottom: "0.25rem" }}>
              Animation & Motion Behavior
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginBottom: "0.75rem" }}>
              Controls whether UI transitions and slide animations are rendered.
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {motionOptions.map((m) => {
                const isSelected = (appSettings.reducedMotion ?? "system") === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleUpdate("appearance.reduced_motion", m.id, "Motion Behavior")}
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
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text Scaling Setting */}
          <div
            style={{
              padding: "0.875rem 1rem",
              borderRadius: "0.5rem",
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <Type style={{ width: "16px", height: "16px", color: "var(--nr-text-secondary)" }} />
              <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                Application Text Scaling
              </div>
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginBottom: "0.75rem" }}>
              Scales typography across all workspaces without breaking layout bounds.
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {textScaleOptions.map((t) => {
                const isSelected = (appSettings.textScale ?? "100%") === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleUpdate("appearance.text_scale", t.id, "Text Scale")}
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
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Enhanced Focus Ring Toggle */}
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
                High-Visibility Focus Indicators
              </div>
              <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginTop: "0.15rem" }}>
                Renders a prominent, high-contrast focus ring around active interactive elements for keyboard navigation.
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(appSettings.enhancedFocus)}
              aria-label="High-Visibility Focus Indicators"
              disabled={updatingKey === "appearance.enhanced_focus"}
              onClick={() =>
                handleUpdate(
                  "appearance.enhanced_focus",
                  String(!appSettings.enhancedFocus),
                  "Enhanced Focus Indicators"
                )
              }
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: appSettings.enhancedFocus ? "var(--nr-accent-purple)" : "var(--nr-border-subtle)",
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
                  left: appSettings.enhancedFocus ? "23px" : "3px",
                  transition: "left 0.2s ease",
                }}
              />
            </button>
          </div>
        </div>
      </section>

      {/* Reset Appearance Section */}
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
              Reset Appearance Preferences
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginTop: "0.25rem" }}>
              Restores theme (Dark), density (Comfortable), reduced motion, text scale, and focus ring to defaults.
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
              <span>Reset Appearance</span>
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

