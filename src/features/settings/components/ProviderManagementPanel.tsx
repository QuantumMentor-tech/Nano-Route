/**
//! Nano Route — Step 46 Provider Management Panel
//! File: src/features/settings/components/ProviderManagementPanel.tsx
//!
//! Provides comprehensive, secure management for all registered AI providers:
//! DPAPI credential entry/replacement/deletion, endpoint configuration,
//! activation toggling, priority weights, and explicit on-demand health probes.
*/

import React, { useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Globe,
  Key,
  Lock,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  checkProviderHealth,
  deleteProviderCredential,
  resetProviderPreferences,
  saveProviderCredential,
  setProviderActive,
  updateProviderPreferences,
  type CheckProviderHealthResultDto,
  type ModelSettingsSummaryDto,
  type ProviderSettingsSummaryDto,
} from "../../../services/ipc";
import {
  formatHealthFreshness,
  formatProviderHealthBadge,
  formatTokenCount,
} from "../settingsFormatters";

interface ProviderManagementPanelProps {
  providers: ProviderSettingsSummaryDto[];
  models: ModelSettingsSummaryDto[];
  onRefresh: () => Promise<void>;
}

export const ProviderManagementPanel: React.FC<ProviderManagementPanelProps> = ({
  providers,
  models,
  onRefresh,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedProviderId, setExpandedProviderId] = useState<string | null>(null);

  // Credential Modal State
  const [credentialModalProvider, setCredentialModalProvider] = useState<ProviderSettingsSummaryDto | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [credSubmitting, setCredSubmitting] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);

  // Delete Credential Modal State
  const [deleteModalProvider, setDeleteModalProvider] = useState<ProviderSettingsSummaryDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Endpoint Edit State
  const [editingEndpointProviderId, setEditingEndpointProviderId] = useState<string | null>(null);
  const [endpointInput, setEndpointInput] = useState("");
  const [endpointSaving, setEndpointSaving] = useState(false);

  // Priority Edit State
  const [editingPriorityProviderId, setEditingPriorityProviderId] = useState<string | null>(null);
  const [priorityInput, setPriorityInput] = useState<number>(5);
  const [prioritySaving, setPrioritySaving] = useState(false);

  // Health Probe State
  const [probingProviderId, setProbingProviderId] = useState<string | null>(null);
  const [healthProbeResult, setHealthProbeResult] = useState<Record<string, CheckProviderHealthResultDto>>({});

  // Busy/Feedback State
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [togglingActiveId, setTogglingActiveId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const filteredProviders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return providers;
    return providers.filter(
      (p) =>
        p.displayName.toLowerCase().includes(q) ||
        p.providerId.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }, [providers, searchQuery]);

  const configuredCount = useMemo(() => providers.filter((p) => p.isConfigured).length, [providers]);
  const activeCount = useMemo(() => providers.filter((p) => p.isConfigured && p.isActive).length, [providers]);

  // Handle Provider Activation Toggle
  const handleToggleActive = async (provider: ProviderSettingsSummaryDto) => {
    if (!provider.isConfigured) return;
    try {
      setTogglingActiveId(provider.providerId);
      const nextActive = !provider.isActive;
      await setProviderActive(provider.providerId, nextActive);
      await onRefresh();
      showNotice(`${provider.displayName} is now ${nextActive ? "ENABLED" : "DISABLED"}.`);
    } catch (err: unknown) {
      showNotice(`Failed to toggle activation: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTogglingActiveId(null);
    }
  };

  // Handle Credential Save (Add / Replace)
  const handleSaveCredential = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentialModalProvider) return;
    const cleanKey = apiKeyInput.trim();
    if (!cleanKey) {
      setCredError("API key cannot be empty.");
      return;
    }

    try {
      setCredSubmitting(true);
      setCredError(null);
      await saveProviderCredential({
        providerId: credentialModalProvider.providerId,
        apiKey: cleanKey,
        baseUrl: credentialModalProvider.configuredBaseUrl,
        priorityWeight: credentialModalProvider.priorityWeight,
        isActive: true,
      });
      // Immediately clear sensitive plaintext key from frontend memory
      setApiKeyInput("");
      setCredentialModalProvider(null);
      await onRefresh();
      showNotice(`API key for ${credentialModalProvider.displayName} encrypted with Windows DPAPI.`);
    } catch (err: unknown) {
      setCredError(err instanceof Error ? err.message : String(err));
    } finally {
      setCredSubmitting(false);
    }
  };

  // Handle Credential Delete
  const handleDeleteCredential = async () => {
    if (!deleteModalProvider) return;
    try {
      setDeleting(true);
      await deleteProviderCredential(deleteModalProvider.providerId);
      setDeleteModalProvider(null);
      await onRefresh();
      showNotice(`Credential for ${deleteModalProvider.displayName} deleted from DPAPI vault.`);
    } catch (err: unknown) {
      showNotice(`Failed to delete credential: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeleting(false);
    }
  };

  // Handle Endpoint Save
  const handleSaveEndpoint = async (providerId: string) => {
    try {
      setEndpointSaving(true);
      const urlToSave = endpointInput.trim() || null;
      await updateProviderPreferences({
        providerId,
        baseUrl: urlToSave,
      });
      setEditingEndpointProviderId(null);
      await onRefresh();
      showNotice("Provider connection endpoint updated.");
    } catch (err: unknown) {
      showNotice(`Failed to update endpoint: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setEndpointSaving(false);
    }
  };

  // Handle Restore Default Endpoint
  const handleRestoreDefaultEndpoint = async (providerId: string) => {
    try {
      setEndpointSaving(true);
      await updateProviderPreferences({
        providerId,
        baseUrl: null,
      });
      setEditingEndpointProviderId(null);
      await onRefresh();
      showNotice("Restored default provider endpoint.");
    } catch (err: unknown) {
      showNotice(`Failed to restore endpoint: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setEndpointSaving(false);
    }
  };

  // Handle Priority Weight Save
  const handleSavePriority = async (providerId: string) => {
    try {
      setPrioritySaving(true);
      await updateProviderPreferences({
        providerId,
        priorityWeight: priorityInput,
      });
      setEditingPriorityProviderId(null);
      await onRefresh();
      showNotice(`Priority weight updated to ${priorityInput}.`);
    } catch (err: unknown) {
      showNotice(`Failed to update priority: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPrioritySaving(false);
    }
  };

  // Handle Reset Provider Preferences (preserves credential)
  const handleResetPreferences = async (provider: ProviderSettingsSummaryDto) => {
    try {
      setResettingId(provider.providerId);
      await resetProviderPreferences(provider.providerId);
      await onRefresh();
      showNotice(`Preferences for ${provider.displayName} reset (credentials preserved).`);
    } catch (err: unknown) {
      showNotice(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResettingId(null);
    }
  };

  // Handle Explicit Health Check Probe
  const handleCheckHealth = async (providerId: string) => {
    try {
      setProbingProviderId(providerId);
      const res = await checkProviderHealth(providerId);
      setHealthProbeResult((prev) => ({ ...prev, [providerId]: res }));
      await onRefresh();
      showNotice(`Health probe completed: ${res.status.toUpperCase()}`);
    } catch (err: unknown) {
      showNotice(`Health probe error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProbingProviderId(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Header Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
        <div
          style={{
            background: "var(--nr-surface-card)",
            border: "1px solid var(--nr-border-subtle)",
            borderRadius: "0.75rem",
            padding: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <Server style={{ width: "24px", height: "24px", color: "var(--nr-accent-purple)" }} />
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--nr-text-primary)" }}>
              {providers.length}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>Registered Providers</div>
          </div>
        </div>

        <div
          style={{
            background: "var(--nr-surface-card)",
            border: "1px solid var(--nr-border-subtle)",
            borderRadius: "0.75rem",
            padding: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <Lock style={{ width: "24px", height: "24px", color: "#4ade80" }} />
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--nr-text-primary)" }}>
              {configuredCount} / {providers.length}
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>Keys Configured (DPAPI)</div>
          </div>
        </div>

        <div
          style={{
            background: "var(--nr-surface-card)",
            border: "1px solid var(--nr-border-subtle)",
            borderRadius: "0.75rem",
            padding: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <Activity style={{ width: "24px", height: "24px", color: "#60a5fa" }} />
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--nr-text-primary)" }}>
              {activeCount} Active
            </div>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>Available for Routing</div>
          </div>
        </div>
      </div>

      {actionNotice && (
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
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search
            style={{
              position: "absolute",
              left: "0.875rem",
              top: "50%",
              transform: "translateY(-50%)",
              width: "16px",
              height: "16px",
              color: "var(--nr-text-secondary)",
            }}
          />
          <input
            type="text"
            placeholder="Filter providers by name, ID, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "0.625rem 0.875rem 0.625rem 2.375rem",
              background: "var(--nr-surface-card)",
              border: "1px solid var(--nr-border-subtle)",
              borderRadius: "0.5rem",
              color: "var(--nr-text-primary)",
              fontSize: "0.875rem",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* Provider List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        {filteredProviders.map((p) => {
          const isExpanded = expandedProviderId === p.providerId;
          const healthBadge = formatProviderHealthBadge(p.healthState);
          const pModels = models.filter((m) => m.providerId === p.providerId);
          const hasCustomEndpoint = !!p.configuredBaseUrl && p.configuredBaseUrl !== p.defaultBaseUrl;

          return (
            <div
              key={p.providerId}
              style={{
                background: "var(--nr-surface-card)",
                border: "1px solid var(--nr-border-subtle)",
                borderRadius: "0.75rem",
                overflow: "hidden",
                transition: "border-color 0.15s ease",
              }}
            >
              {/* Card Header Row */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "1rem 1.25rem",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.875rem" }}>
                  <button
                    type="button"
                    onClick={() => setExpandedProviderId(isExpanded ? null : p.providerId)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--nr-text-secondary)",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center",
                    }}
                    aria-label={isExpanded ? "Collapse provider" : "Expand provider"}
                  >
                    {isExpanded ? <ChevronUp style={{ width: "20px", height: "20px" }} /> : <ChevronDown style={{ width: "20px", height: "20px" }} />}
                  </button>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                        {p.displayName}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontFamily: "var(--nr-font-mono, monospace)",
                          padding: "0.125rem 0.375rem",
                          borderRadius: "0.25rem",
                          background: "var(--nr-surface-raised)",
                          color: "var(--nr-text-secondary)",
                        }}
                      >
                        {p.providerId}
                      </span>
                      {hasCustomEndpoint && (
                        <span
                          style={{
                            fontSize: "0.6875rem",
                            padding: "0.125rem 0.375rem",
                            borderRadius: "0.25rem",
                            background: "rgba(59, 130, 246, 0.12)",
                            color: "#60a5fa",
                            border: "1px solid rgba(59, 130, 246, 0.3)",
                          }}
                        >
                          Custom Endpoint
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", marginTop: "0.125rem" }}>
                      {p.description}
                    </div>
                  </div>
                </div>

                {/* Right Header Status & Action Controls */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginLeft: "auto" }}>
                  {/* Health State Badge with Freshness */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        padding: "0.2rem 0.5rem",
                        borderRadius: "0.25rem",
                        background: healthBadge.bg,
                        color: healthBadge.color,
                        border: `1px solid ${healthBadge.borderColor}`,
                      }}
                    >
                      {healthBadge.label}
                    </span>
                    <span style={{ fontSize: "0.6875rem", color: "var(--nr-text-secondary)", marginTop: "0.125rem" }}>
                      {formatHealthFreshness(p.healthCheckedAtMs)}
                    </span>
                  </div>

                  {/* Active Toggle Switch */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginLeft: "0.5rem" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={p.isActive}
                      aria-label={`Toggle ${p.displayName} activation`}
                      disabled={!p.isConfigured || togglingActiveId === p.providerId}
                      onClick={() => handleToggleActive(p)}
                      title={!p.isConfigured ? "Add API key first to enable provider" : undefined}
                      style={{
                        width: "36px",
                        height: "20px",
                        borderRadius: "10px",
                        background: p.isConfigured && p.isActive ? "var(--nr-accent-purple)" : "var(--nr-border-subtle)",
                        border: "none",
                        cursor: p.isConfigured ? "pointer" : "not-allowed",
                        opacity: p.isConfigured ? 1 : 0.4,
                        position: "relative",
                        transition: "background 0.2s ease",
                      }}
                    >
                      <div
                        style={{
                          width: "14px",
                          height: "14px",
                          borderRadius: "50%",
                          background: "#fff",
                          position: "absolute",
                          top: "3px",
                          left: p.isConfigured && p.isActive ? "19px" : "3px",
                          transition: "left 0.2s ease",
                        }}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Collapsed / Expanded Content */}
              {isExpanded && (
                <div
                  style={{
                    padding: "1rem 1.25rem 1.25rem 1.25rem",
                    borderTop: "1px solid var(--nr-border-subtle)",
                    background: "rgba(0, 0, 0, 0.15)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "1rem",
                  }}
                >
                  {/* Provider Actions Toolbar */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                    {/* Check Health On-Demand */}
                    <button
                      type="button"
                      onClick={() => handleCheckHealth(p.providerId)}
                      disabled={probingProviderId === p.providerId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.375rem 0.75rem",
                        borderRadius: "0.375rem",
                        background: "var(--nr-surface-raised)",
                        border: "1px solid var(--nr-border-subtle)",
                        color: "var(--nr-text-primary)",
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      <RefreshCw
                        style={{
                          width: "14px",
                          height: "14px",
                          animation: probingProviderId === p.providerId ? "spin 1s linear infinite" : undefined,
                        }}
                      />
                      <span>{probingProviderId === p.providerId ? "Checking..." : "Check Health"}</span>
                    </button>

                    {/* Add / Replace API Key */}
                    <button
                      type="button"
                      onClick={() => {
                        setApiKeyInput("");
                        setCredError(null);
                        setCredentialModalProvider(p);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        padding: "0.375rem 0.75rem",
                        borderRadius: "0.375rem",
                        background: p.isConfigured ? "var(--nr-surface-raised)" : "var(--nr-accent-purple)",
                        border: p.isConfigured ? "1px solid var(--nr-border-subtle)" : "none",
                        color: "#fff",
                        fontSize: "0.8125rem",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      <Key style={{ width: "14px", height: "14px" }} />
                      <span>{p.isConfigured ? "Replace API Key" : "Add API Key"}</span>
                    </button>

                    {/* Delete API Key (only if configured) */}
                    {p.isConfigured && (
                      <button
                        type="button"
                        onClick={() => setDeleteModalProvider(p)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          padding: "0.375rem 0.75rem",
                          borderRadius: "0.375rem",
                          background: "rgba(239, 68, 68, 0.12)",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          color: "#f87171",
                          fontSize: "0.8125rem",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 style={{ width: "14px", height: "14px" }} />
                        <span>Delete Key</span>
                      </button>
                    )}

                    {/* Reset Preferences */}
                    {p.isConfigured && (
                      <button
                        type="button"
                        onClick={() => handleResetPreferences(p)}
                        disabled={resettingId === p.providerId}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          padding: "0.375rem 0.75rem",
                          borderRadius: "0.375rem",
                          background: "transparent",
                          border: "1px solid var(--nr-border-subtle)",
                          color: "var(--nr-text-secondary)",
                          fontSize: "0.8125rem",
                          cursor: "pointer",
                          marginLeft: "auto",
                        }}
                      >
                        <RefreshCw style={{ width: "12px", height: "12px" }} />
                        <span>Reset Preferences</span>
                      </button>
                    )}
                  </div>

                  {/* Health Probe Result Alert (if probe was run) */}
                  {healthProbeResult[p.providerId] && (
                    <div
                      style={{
                        padding: "0.625rem 0.875rem",
                        borderRadius: "0.375rem",
                        background:
                          healthProbeResult[p.providerId].status === "ready"
                            ? "rgba(34, 197, 94, 0.08)"
                            : "rgba(249, 115, 22, 0.08)",
                        border:
                          healthProbeResult[p.providerId].status === "ready"
                            ? "1px solid rgba(34, 197, 94, 0.25)"
                            : "1px solid rgba(249, 115, 22, 0.25)",
                        fontSize: "0.8125rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        color: "var(--nr-text-primary)",
                      }}
                    >
                      {healthProbeResult[p.providerId].status === "ready" ? (
                        <CheckCircle2 style={{ width: "16px", height: "16px", color: "#4ade80" }} />
                      ) : (
                        <AlertCircle style={{ width: "16px", height: "16px", color: "#fb923c" }} />
                      )}
                      <span>
                        Probe result: <strong>{healthProbeResult[p.providerId].status.toUpperCase()}</strong> —{" "}
                        {healthProbeResult[p.providerId].errorCategory || "Minimal test check succeeded without sending user prompt text."}
                        {healthProbeResult[p.providerId].latencyMs ? ` (${healthProbeResult[p.providerId].latencyMs}ms)` : ""}
                      </span>
                    </div>
                  )}

                  {/* Configuration & Details Grid */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: "0.875rem",
                    }}
                  >
                    {/* Endpoint Configuration Block */}
                    <div
                      style={{
                        background: "var(--nr-surface-raised)",
                        border: "1px solid var(--nr-border-subtle)",
                        borderRadius: "0.5rem",
                        padding: "0.875rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8125rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                          <Globe style={{ width: "14px", height: "14px", color: "var(--nr-accent-purple)" }} />
                          <span>Connection Endpoint</span>
                        </div>
                        {editingEndpointProviderId !== p.providerId && p.isConfigured && (
                          <button
                            type="button"
                            onClick={() => {
                              setEndpointInput(p.configuredBaseUrl || p.defaultBaseUrl);
                              setEditingEndpointProviderId(p.providerId);
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--nr-accent-purple)",
                              fontSize: "0.75rem",
                              fontWeight: 500,
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </div>

                      {editingEndpointProviderId === p.providerId ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <input
                            type="text"
                            value={endpointInput}
                            onChange={(e) => setEndpointInput(e.target.value)}
                            placeholder={p.defaultBaseUrl}
                            style={{
                              width: "100%",
                              padding: "0.4rem 0.625rem",
                              background: "var(--nr-surface-card)",
                              border: "1px solid var(--nr-border-subtle)",
                              borderRadius: "0.375rem",
                              color: "var(--nr-text-primary)",
                              fontSize: "0.8125rem",
                              fontFamily: "var(--nr-font-mono, monospace)",
                            }}
                          />
                          <div style={{ display: "flex", gap: "0.375rem" }}>
                            <button
                              type="button"
                              onClick={() => handleSaveEndpoint(p.providerId)}
                              disabled={endpointSaving}
                              style={{
                                padding: "0.3rem 0.625rem",
                                borderRadius: "0.25rem",
                                background: "var(--nr-accent-purple)",
                                border: "none",
                                color: "#fff",
                                fontSize: "0.75rem",
                                fontWeight: 500,
                                cursor: "pointer",
                              }}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRestoreDefaultEndpoint(p.providerId)}
                              disabled={endpointSaving}
                              style={{
                                padding: "0.3rem 0.625rem",
                                borderRadius: "0.25rem",
                                background: "transparent",
                                border: "1px solid var(--nr-border-subtle)",
                                color: "var(--nr-text-secondary)",
                                fontSize: "0.75rem",
                                cursor: "pointer",
                              }}
                            >
                              Restore Default
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingEndpointProviderId(null)}
                              disabled={endpointSaving}
                              style={{
                                padding: "0.3rem 0.5rem",
                                borderRadius: "0.25rem",
                                background: "transparent",
                                border: "none",
                                color: "var(--nr-text-secondary)",
                                fontSize: "0.75rem",
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.8125rem", fontFamily: "var(--nr-font-mono, monospace)", color: "var(--nr-text-secondary)", wordBreak: "break-all" }}>
                          {p.configuredBaseUrl ? p.configuredBaseUrl : `${p.defaultBaseUrl} (default)`}
                        </div>
                      )}
                    </div>

                    {/* Priority Weight Block */}
                    <div
                      style={{
                        background: "var(--nr-surface-raised)",
                        border: "1px solid var(--nr-border-subtle)",
                        borderRadius: "0.5rem",
                        padding: "0.875rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                        <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                          Priority Weight
                        </div>
                        {editingPriorityProviderId !== p.providerId && p.isConfigured && (
                          <button
                            type="button"
                            onClick={() => {
                              setPriorityInput(p.priorityWeight);
                              setEditingPriorityProviderId(p.providerId);
                            }}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--nr-accent-purple)",
                              fontSize: "0.75rem",
                              fontWeight: 500,
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </div>

                      {editingPriorityProviderId === p.providerId ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <input
                            type="range"
                            min="1"
                            max="10"
                            value={priorityInput}
                            onChange={(e) => setPriorityInput(parseInt(e.target.value, 10))}
                            style={{ flex: 1 }}
                          />
                          <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)", width: "20px" }}>
                            {priorityInput}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSavePriority(p.providerId)}
                            disabled={prioritySaving}
                            style={{
                              padding: "0.25rem 0.5rem",
                              borderRadius: "0.25rem",
                              background: "var(--nr-accent-purple)",
                              border: "none",
                              color: "#fff",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPriorityProviderId(null)}
                            style={{
                              padding: "0.25rem",
                              background: "transparent",
                              border: "none",
                              color: "var(--nr-text-secondary)",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
                          Weight: <strong>{p.priorityWeight} / 10</strong> (Default: 5)
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Registered Models List */}
                  <div>
                    <div style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--nr-text-primary)", marginBottom: "0.5rem" }}>
                      Registered Models ({pModels.length})
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.5rem" }}>
                      {pModels.map((m) => (
                        <div
                          key={m.modelId}
                          style={{
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.375rem",
                            background: "var(--nr-surface-raised)",
                            border: "1px solid var(--nr-border-subtle)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div>
                            <div style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--nr-text-primary)" }}>
                              {m.displayName}
                            </div>
                            <div style={{ fontSize: "0.6875rem", color: "var(--nr-text-secondary)" }}>
                              {formatTokenCount(m.contextWindow)} window
                            </div>
                          </div>
                          {m.isDefault && (
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                padding: "0.1rem 0.35rem",
                                borderRadius: "0.25rem",
                                background: "rgba(168, 85, 247, 0.15)",
                                color: "var(--nr-accent-purple)",
                                fontWeight: 600,
                              }}
                            >
                              Default
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* API Key Modal */}
      {credentialModalProvider && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cred-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
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
              width: "100%",
              maxWidth: "480px",
              background: "var(--nr-surface-card)",
              border: "1px solid var(--nr-border-subtle)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <Lock style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
              <h3 id="cred-modal-title" style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
                {credentialModalProvider.isConfigured ? "Replace API Key" : "Add API Key"} — {credentialModalProvider.displayName}
              </h3>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", margin: "0 0 1rem 0" }}>
              Your API key will be encrypted using <strong>Windows DPAPI</strong> and stored in local SQLite. The plaintext key is never persisted to disk or exposed in browser storage.
            </p>

            {credError && (
              <div
                style={{
                  padding: "0.625rem 0.875rem",
                  borderRadius: "0.375rem",
                  background: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#f87171",
                  fontSize: "0.8125rem",
                  marginBottom: "1rem",
                }}
              >
                {credError}
              </div>
            )}

            <form onSubmit={handleSaveCredential}>
              <div style={{ marginBottom: "1.25rem" }}>
                <label
                  htmlFor="api-key-input"
                  style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--nr-text-primary)", marginBottom: "0.375rem" }}
                >
                  API Secret Key
                </label>
                <input
                  id="api-key-input"
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="Paste provider API key here..."
                  autoFocus
                  required
                  autoComplete="off"
                  spellCheck="false"
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.75rem",
                    borderRadius: "0.375rem",
                    background: "var(--nr-surface-raised)",
                    border: "1px solid var(--nr-border-subtle)",
                    color: "var(--nr-text-primary)",
                    fontSize: "0.875rem",
                    fontFamily: "var(--nr-font-mono, monospace)",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={() => {
                    setApiKeyInput("");
                    setCredentialModalProvider(null);
                  }}
                  disabled={credSubmitting}
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
                  disabled={credSubmitting || !apiKeyInput.trim()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 1rem",
                    borderRadius: "0.375rem",
                    background: "var(--nr-accent-purple)",
                    border: "none",
                    color: "#fff",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: credSubmitting || !apiKeyInput.trim() ? "not-allowed" : "pointer",
                    opacity: credSubmitting || !apiKeyInput.trim() ? 0.6 : 1,
                  }}
                >
                  {credSubmitting && <RefreshCw style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />}
                  <span>{credSubmitting ? "Encrypting..." : "Encrypt & Save"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Credential Confirmation Modal */}
      {deleteModalProvider && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="del-modal-title"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.75)",
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
              width: "100%",
              maxWidth: "440px",
              background: "var(--nr-surface-card)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "0.75rem",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <ShieldAlert style={{ width: "20px", height: "20px", color: "#f87171" }} />
              <h3 id="del-modal-title" style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
                Delete API Key — {deleteModalProvider.displayName}
              </h3>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", margin: "0 0 1.25rem 0" }}>
              Are you sure you want to delete the encrypted credential for <strong>{deleteModalProvider.displayName}</strong>?
              This provider will be marked unconfigured and excluded from future routing. Historical chats and telemetry are preserved.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setDeleteModalProvider(null)}
                disabled={deleting}
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
                type="button"
                onClick={handleDeleteCredential}
                disabled={deleting}
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
                {deleting && <RefreshCw style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />}
                <span>Delete Credential</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

