/**
 * Nano Route — Workspace Profiles & Preference Presets Panel
 * File: src/features/profiles/components/WorkspaceProfilesPanel.tsx
 *
 * Implements Step 67 UI for listing, activating, creating, deleting,
 * exporting, and safely importing local workspace profiles.
 */

import React, { useState, useRef } from "react";
import {
  Sliders,
  CheckCircle2,
  Download,
  Upload,
  Trash2,
  Plus,
  Sparkles,
  Layers,
  FileText,
  AlertTriangle,
  X,
  Info,
  ShieldCheck,
  Eye,
  Minimize2,
} from "lucide-react";
import { useProfiles } from "../ProfilesContext.tsx";
import { type WorkspaceProfile, type ProfileImportPreview, MAX_PROFILES_COUNT } from "../types.ts";

export const WorkspaceProfilesPanel: React.FC = () => {
  const {
    profiles,
    activeProfile,
    activeProfileId,
    loading,
    createProfile,
    activateProfile,
    deleteProfile,
    exportProfile,
    previewProfile,
    importProfile,
  } = useProfiles();

  // Create Profile Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [newProfileDesc, setNewProfileDesc] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Import Profile Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importJsonText, setImportJsonText] = useState("");
  const [importPreview, setImportPreview] = useState<ProfileImportPreview | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deletion Confirmation State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Handle Export File Download
  const handleExport = (profile: WorkspaceProfile) => {
    try {
      const jsonStr = exportProfile(profile.id);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const safeName = profile.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const a = document.createElement("a");
      a.href = url;
      a.download = `nano-route-profile-${safeName}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      console.error("Export failed:", err);
    }
  };

  // Handle Create Profile Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    try {
      await createProfile(newProfileName, newProfileDesc);
      setShowCreateModal(false);
      setNewProfileName("");
      setNewProfileDesc("");
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : String(err));
    }
  };

  // Handle File Picker for Import
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJsonText(content);
      handleJsonParse(content);
    };
    reader.readAsText(file);
  };

  // Live preview parser
  const handleJsonParse = (json: string) => {
    setImportError(null);
    if (!json.trim()) {
      setImportPreview(null);
      return;
    }
    try {
      const preview = previewProfile(json);
      setImportPreview(preview);
    } catch (err: unknown) {
      setImportPreview(null);
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  // Execute Import
  const handleImportSubmit = async (overwriteMode: "copy" | "replace" = "copy", andActivate = false) => {
    if (!importJsonText) return;
    try {
      const imported = await importProfile(importJsonText, overwriteMode);
      if (andActivate) {
        await activateProfile(imported.id);
      }
      setShowImportModal(false);
      setImportJsonText("");
      setImportPreview(null);
      setImportError(null);
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  };

  // Render Preset Icon
  const getPresetIcon = (id: string) => {
    switch (id) {
      case "prof_focus":
        return <Sparkles style={{ width: "18px", height: "18px", color: "var(--nr-accent-focus, #38bdf8)" }} />;
      case "prof_compact":
        return <Minimize2 style={{ width: "18px", height: "18px", color: "var(--nr-accent-warning, #f59e0b)" }} />;
      case "prof_accessibility":
        return <Eye style={{ width: "18px", height: "18px", color: "var(--nr-accent-success, #10b981)" }} />;
      default:
        return <Sliders style={{ width: "18px", height: "18px", color: "var(--nr-primary, #6366f1)" }} />;
    }
  };

  const builtinProfiles = profiles.filter((p) => p.isBuiltin);
  const customProfiles = profiles.filter((p) => !p.isBuiltin);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Intro Header */}
      <div
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: "680px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
            <Layers style={{ width: "20px", height: "20px", color: "var(--nr-primary)" }} />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0, color: "var(--nr-text-primary)" }}>
              Workspace Profiles & Presets
            </h2>
          </div>
          <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--nr-text-secondary)", lineHeight: 1.5 }}>
            Switch between purpose-built layouts and interaction presets. Profiles store non-sensitive visual and
            interaction preferences. They <strong>never</strong> modify provider keys, routing models, chat history,
            or local database storage.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            disabled={profiles.length >= MAX_PROFILES_COUNT || loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              background: "var(--nr-primary)",
              color: "#fff",
              border: "none",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: profiles.length >= MAX_PROFILES_COUNT || loading ? "not-allowed" : "pointer",
              opacity: profiles.length >= MAX_PROFILES_COUNT || loading ? 0.6 : 1,
            }}
          >
            <Plus style={{ width: "16px", height: "16px" }} />
            Save Current as Profile
          </button>

          <button
            type="button"
            onClick={() => {
              setImportJsonText("");
              setImportPreview(null);
              setImportError(null);
              setShowImportModal(true);
            }}
            disabled={profiles.length >= MAX_PROFILES_COUNT || loading}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              borderRadius: "0.5rem",
              background: "transparent",
              color: "var(--nr-text-primary)",
              border: "1px solid var(--nr-border-subtle)",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: profiles.length >= MAX_PROFILES_COUNT || loading ? "not-allowed" : "pointer",
              opacity: profiles.length >= MAX_PROFILES_COUNT || loading ? 0.6 : 1,
            }}
          >
            <Upload style={{ width: "16px", height: "16px" }} />
            Import Profile
          </button>
        </div>
      </div>

      {/* Active Profile Card Banner */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(56, 189, 248, 0.04) 100%)",
          border: "1px solid var(--nr-primary)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "0.5rem",
              background: "rgba(99, 102, 241, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {getPresetIcon(activeProfile.id)}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--nr-primary)" }}>
                Active Profile
              </span>
              <span
                style={{
                  fontSize: "0.75rem",
                  padding: "0.125rem 0.5rem",
                  borderRadius: "9999px",
                  background: activeProfile.isBuiltin ? "rgba(99, 102, 241, 0.2)" : "rgba(16, 185, 129, 0.2)",
                  color: activeProfile.isBuiltin ? "var(--nr-primary)" : "var(--nr-accent-success, #10b981)",
                  fontWeight: 600,
                }}
              >
                {activeProfile.isBuiltin ? "Built-in Preset" : "Custom Profile"}
              </span>
            </div>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0, color: "var(--nr-text-primary)" }}>
              {activeProfile.name}
            </h3>
            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", color: "var(--nr-text-secondary)" }}>
              {activeProfile.description}
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => handleExport(activeProfile)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.4rem 0.8rem",
              borderRadius: "0.375rem",
              background: "var(--nr-surface-card)",
              border: "1px solid var(--nr-border-subtle)",
              color: "var(--nr-text-primary)",
              fontSize: "0.8125rem",
              cursor: "pointer",
            }}
          >
            <Download style={{ width: "14px", height: "14px" }} />
            Export Profile
          </button>
        </div>
      </div>

      {/* Built-in Presets Grid */}
      <div>
        <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary)", marginBottom: "0.75rem" }}>
          Standard Workspace Presets
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
          {builtinProfiles.map((p) => {
            const isActive = p.id === activeProfileId;
            return (
              <div
                key={p.id}
                style={{
                  background: "var(--nr-surface-card)",
                  border: isActive ? "2px solid var(--nr-primary)" : "1px solid var(--nr-border-subtle)",
                  borderRadius: "0.625rem",
                  padding: "1rem",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  position: "relative",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      {getPresetIcon(p.id)}
                      <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--nr-text-primary)" }}>
                        {p.name}
                      </span>
                    </div>
                    {isActive ? (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "var(--nr-accent-success, #10b981)",
                        }}
                      >
                        <CheckCircle2 style={{ width: "14px", height: "14px" }} />
                        Active
                      </span>
                    ) : null}
                  </div>
                  <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--nr-text-secondary)", lineHeight: 1.4 }}>
                    {p.description}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--nr-border-subtle)", paddingTop: "0.75rem", marginTop: "0.25rem" }}>
                  <button
                    type="button"
                    onClick={() => handleExport(p)}
                    title="Export preset to JSON"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.3rem 0.6rem",
                      borderRadius: "0.375rem",
                      background: "transparent",
                      border: "1px solid var(--nr-border-subtle)",
                      color: "var(--nr-text-secondary)",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    <Download style={{ width: "12px", height: "12px" }} />
                    Export
                  </button>

                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => activateProfile(p.id)}
                      disabled={loading}
                      style={{
                        padding: "0.35rem 0.85rem",
                        borderRadius: "0.375rem",
                        background: "var(--nr-primary)",
                        color: "#fff",
                        border: "none",
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        cursor: loading ? "wait" : "pointer",
                      }}
                    >
                      Activate
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom User Profiles */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
            Custom Profiles ({customProfiles.length} / {MAX_PROFILES_COUNT - builtinProfiles.length})
          </h3>
        </div>

        {customProfiles.length === 0 ? (
          <div
            style={{
              background: "var(--nr-surface-card)",
              border: "1px dashed var(--nr-border-subtle)",
              borderRadius: "0.625rem",
              padding: "2rem",
              textAlign: "center",
              color: "var(--nr-text-secondary)",
            }}
          >
            <Sliders style={{ width: "32px", height: "32px", margin: "0 auto 0.5rem auto", opacity: 0.5 }} />
            <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", fontWeight: 500, color: "var(--nr-text-primary)" }}>
              No custom profiles saved yet
            </p>
            <p style={{ margin: "0 0 1rem 0", fontSize: "0.8125rem" }}>
              Configure appearance, chat, and notification preferences to your liking, then save them as a reusable profile.
            </p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              style={{
                padding: "0.4rem 0.85rem",
                borderRadius: "0.375rem",
                background: "var(--nr-surface-card)",
                border: "1px solid var(--nr-border-subtle)",
                color: "var(--nr-text-primary)",
                fontSize: "0.8125rem",
                cursor: "pointer",
              }}
            >
              Save Current Workspace
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1rem" }}>
            {customProfiles.map((p) => {
              const isActive = p.id === activeProfileId;
              const isConfirmingDelete = deletingId === p.id;

              return (
                <div
                  key={p.id}
                  style={{
                    background: "var(--nr-surface-card)",
                    border: isActive ? "2px solid var(--nr-primary)" : "1px solid var(--nr-border-subtle)",
                    borderRadius: "0.625rem",
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.9375rem", color: "var(--nr-text-primary)" }}>
                        {p.name}
                      </span>
                      {isActive ? (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: "var(--nr-accent-success, #10b981)",
                          }}
                        >
                          <CheckCircle2 style={{ width: "14px", height: "14px" }} />
                          Active
                        </span>
                      ) : null}
                    </div>
                    <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--nr-text-secondary)", lineHeight: 1.4 }}>
                      {p.description || "Custom workspace configuration."}
                    </p>
                    <div style={{ fontSize: "0.75rem", color: "var(--nr-text-tertiary, #94a3b8)", marginTop: "0.5rem" }}>
                      Saved: {new Date(p.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      borderTop: "1px solid var(--nr-border-subtle)",
                      paddingTop: "0.75rem",
                      marginTop: "0.25rem",
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        onClick={() => handleExport(p)}
                        title="Export profile to JSON"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          padding: "0.3rem 0.5rem",
                          borderRadius: "0.375rem",
                          background: "transparent",
                          border: "1px solid var(--nr-border-subtle)",
                          color: "var(--nr-text-secondary)",
                          fontSize: "0.75rem",
                          cursor: "pointer",
                        }}
                      >
                        <Download style={{ width: "12px", height: "12px" }} />
                        Export
                      </button>

                      {isConfirmingDelete ? (
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteProfile(p.id);
                              setDeletingId(null);
                            }}
                            style={{
                              padding: "0.3rem 0.5rem",
                              borderRadius: "0.375rem",
                              background: "var(--nr-accent-danger, #ef4444)",
                              color: "#fff",
                              border: "none",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(null)}
                            style={{
                              padding: "0.3rem 0.5rem",
                              borderRadius: "0.375rem",
                              background: "transparent",
                              border: "1px solid var(--nr-border-subtle)",
                              color: "var(--nr-text-secondary)",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingId(p.id)}
                          title="Delete profile"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            padding: "0.3rem 0.5rem",
                            borderRadius: "0.375rem",
                            background: "transparent",
                            border: "1px solid var(--nr-border-subtle)",
                            color: "var(--nr-accent-danger, #ef4444)",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          <Trash2 style={{ width: "12px", height: "12px" }} />
                        </button>
                      )}
                    </div>

                    {!isActive && (
                      <button
                        type="button"
                        onClick={() => activateProfile(p.id)}
                        disabled={loading}
                        style={{
                          padding: "0.35rem 0.85rem",
                          borderRadius: "0.375rem",
                          background: "var(--nr-primary)",
                          color: "#fff",
                          border: "none",
                          fontSize: "0.8125rem",
                          fontWeight: 500,
                          cursor: loading ? "wait" : "pointer",
                        }}
                      >
                        Activate
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security & Boundary Notice */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.75rem",
          padding: "1rem",
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.5rem",
          fontSize: "0.8125rem",
          color: "var(--nr-text-secondary)",
        }}
      >
        <ShieldCheck style={{ width: "18px", height: "18px", color: "var(--nr-accent-success, #10b981)", flexShrink: 0, marginTop: "2px" }} />
        <div>
          <strong style={{ color: "var(--nr-text-primary)" }}>Zero Credential & Secrets Guarantee:</strong> Workspace
          profiles strictly snapshot non-sensitive presentation and interaction preferences. Profiles never contain API keys,
          DPAPI ciphertexts, conversation transcripts, tokens, or network endpoints.
        </div>
      </div>

      {/* Modal: Save Current Workspace as Profile */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="save-profile-title"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--nr-surface-card)",
              border: "1px solid var(--nr-border-subtle)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              maxWidth: "480px",
              width: "100%",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h3 id="save-profile-title" style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0, color: "var(--nr-text-primary)" }}>
                Save Current Workspace
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                style={{ background: "transparent", border: "none", color: "var(--nr-text-secondary)", cursor: "pointer" }}
              >
                <X style={{ width: "18px", height: "18px" }} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--nr-text-primary)", marginBottom: "0.35rem" }}>
                  Profile Name <span style={{ color: "var(--nr-accent-danger, #ef4444)" }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  placeholder="e.g. Late Night Writing"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    background: "var(--nr-surface-secondary, rgba(0,0,0,0.2))",
                    border: "1px solid var(--nr-border-subtle)",
                    color: "var(--nr-text-primary)",
                    fontSize: "0.875rem",
                    boxSizing: "border-box",
                  }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>
                  {newProfileName.length}/40 characters
                </span>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 500, color: "var(--nr-text-primary)", marginBottom: "0.35rem" }}>
                  Description (Optional)
                </label>
                <textarea
                  maxLength={120}
                  rows={2}
                  placeholder="e.g. Dark theme with comfortable spacing and suppressed non-critical toasts."
                  value={newProfileDesc}
                  onChange={(e) => setNewProfileDesc(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.375rem",
                    background: "var(--nr-surface-secondary, rgba(0,0,0,0.2))",
                    border: "1px solid var(--nr-border-subtle)",
                    color: "var(--nr-text-primary)",
                    fontSize: "0.875rem",
                    resize: "none",
                    boxSizing: "border-box",
                  }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>
                  {newProfileDesc.length}/120 characters
                </span>
              </div>

              {createError && (
                <div style={{ color: "var(--nr-accent-danger, #ef4444)", fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <AlertTriangle style={{ width: "14px", height: "14px" }} />
                  {createError}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: "0.5rem 1rem",
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
                <button
                  type="submit"
                  disabled={!newProfileName.trim() || loading}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.375rem",
                    background: "var(--nr-primary)",
                    color: "#fff",
                    border: "none",
                    fontSize: "0.875rem",
                    fontWeight: 500,
                    cursor: !newProfileName.trim() || loading ? "not-allowed" : "pointer",
                    opacity: !newProfileName.trim() || loading ? 0.6 : 1,
                  }}
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Import Profile Preview & Confirmation */}
      {showImportModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-profile-title"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "var(--nr-surface-card)",
              border: "1px solid var(--nr-border-subtle)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              maxWidth: "600px",
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <h3 id="import-profile-title" style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0, color: "var(--nr-text-primary)" }}>
                Import Workspace Profile
              </h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                style={{ background: "transparent", border: "none", color: "var(--nr-text-secondary)", cursor: "pointer" }}
              >
                <X style={{ width: "18px", height: "18px" }} />
              </button>
            </div>

            {/* File Chooser & Paste Area */}
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.45rem 0.85rem",
                    borderRadius: "0.375rem",
                    background: "var(--nr-surface-card)",
                    border: "1px solid var(--nr-border-subtle)",
                    color: "var(--nr-text-primary)",
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                  }}
                >
                  <FileText style={{ width: "14px", height: "14px" }} />
                  Choose JSON File...
                </button>
                <span style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>
                  or paste JSON payload below:
                </span>
              </div>

              <textarea
                rows={4}
                placeholder='Paste profile JSON here (e.g. {"format": "nano-route-workspace-profile-v1", ...})'
                value={importJsonText}
                onChange={(e) => {
                  setImportJsonText(e.target.value);
                  handleJsonParse(e.target.value);
                }}
                style={{
                  width: "100%",
                  fontFamily: "monospace",
                  fontSize: "0.75rem",
                  padding: "0.5rem",
                  borderRadius: "0.375rem",
                  background: "var(--nr-surface-secondary, rgba(0,0,0,0.2))",
                  border: "1px solid var(--nr-border-subtle)",
                  color: "var(--nr-text-primary)",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {importError && (
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.375rem",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid var(--nr-accent-danger, #ef4444)",
                  color: "var(--nr-accent-danger, #ef4444)",
                  fontSize: "0.8125rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "1rem",
                }}
              >
                <AlertTriangle style={{ width: "16px", height: "16px", flexShrink: 0 }} />
                <span>{importError}</span>
              </div>
            )}

            {/* Import Preview Card */}
            {importPreview && (
              <div
                style={{
                  background: "var(--nr-surface-secondary, rgba(0,0,0,0.15))",
                  border: "1px solid var(--nr-border-subtle)",
                  borderRadius: "0.5rem",
                  padding: "1rem",
                  marginBottom: "1.25rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.75rem" }}>
                  <div>
                    <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                      {importPreview.profile.name}
                    </h4>
                    <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
                      {importPreview.profile.description}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.125rem 0.5rem",
                      borderRadius: "9999px",
                      background: "rgba(56, 189, 248, 0.2)",
                      color: "var(--nr-accent-focus, #38bdf8)",
                      fontWeight: 600,
                    }}
                  >
                    Schema v{importPreview.validation.schemaVersion}
                  </span>
                </div>

                {importPreview.isExistingName && (
                  <div
                    style={{
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.375rem",
                      background: "rgba(245, 158, 11, 0.1)",
                      border: "1px solid var(--nr-accent-warning, #f59e0b)",
                      color: "var(--nr-accent-warning, #f59e0b)",
                      fontSize: "0.75rem",
                      marginBottom: "0.75rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <Info style={{ width: "14px", height: "14px", flexShrink: 0 }} />
                    <span>A profile named "{importPreview.profile.name}" already exists. You can replace it or import as a copy.</span>
                  </div>
                )}

                {/* Diffs Summary */}
                <h5 style={{ margin: "0 0 0.5rem 0", fontSize: "0.8125rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                  Settings Difference ({importPreview.diffs.filter((d) => d.willChange).length} change(s)):
                </h5>
                <div style={{ maxHeight: "160px", overflowY: "auto", border: "1px solid var(--nr-border-subtle)", borderRadius: "0.375rem" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                    <thead>
                      <tr style={{ background: "rgba(0,0,0,0.2)", textAlign: "left", color: "var(--nr-text-secondary)" }}>
                        <th style={{ padding: "0.375rem 0.5rem" }}>Preference</th>
                        <th style={{ padding: "0.375rem 0.5rem" }}>Current</th>
                        <th style={{ padding: "0.375rem 0.5rem" }}>Imported Target</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.diffs.map((d) => (
                        <tr
                          key={d.key}
                          style={{
                            borderTop: "1px solid var(--nr-border-subtle)",
                            background: d.willChange ? "rgba(99, 102, 241, 0.08)" : "transparent",
                          }}
                        >
                          <td style={{ padding: "0.375rem 0.5rem", color: "var(--nr-text-primary)", fontWeight: d.willChange ? 600 : 400 }}>
                            {d.label}
                          </td>
                          <td style={{ padding: "0.375rem 0.5rem", color: "var(--nr-text-secondary)" }}>
                            {d.currentValue}
                          </td>
                          <td
                            style={{
                              padding: "0.375rem 0.5rem",
                              color: d.willChange ? "var(--nr-primary)" : "var(--nr-text-secondary)",
                              fontWeight: d.willChange ? 600 : 400,
                            }}
                          >
                            {d.targetValue}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                style={{
                  padding: "0.5rem 1rem",
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

              {importPreview && importPreview.isExistingName && (
                <button
                  type="button"
                  onClick={() => handleImportSubmit("replace", false)}
                  style={{
                    padding: "0.5rem 0.85rem",
                    borderRadius: "0.375rem",
                    background: "var(--nr-accent-warning, #f59e0b)",
                    color: "#fff",
                    border: "none",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Replace Existing
                </button>
              )}

              {importPreview && (
                <>
                  <button
                    type="button"
                    onClick={() => handleImportSubmit("copy", false)}
                    style={{
                      padding: "0.5rem 0.85rem",
                      borderRadius: "0.375rem",
                      background: "var(--nr-surface-card)",
                      border: "1px solid var(--nr-border-subtle)",
                      color: "var(--nr-text-primary)",
                      fontSize: "0.8125rem",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Import Only
                  </button>
                  <button
                    type="button"
                    onClick={() => handleImportSubmit(importPreview.isExistingName ? "replace" : "copy", true)}
                    style={{
                      padding: "0.5rem 1rem",
                      borderRadius: "0.375rem",
                      background: "var(--nr-primary)",
                      color: "#fff",
                      border: "none",
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Import & Activate Now
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
