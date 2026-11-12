/**
//! Nano Route — Step 46 Models & Routing Preferences Panel
//! File: src/features/settings/components/ModelsAndRoutingPanel.tsx
//!
//! Exposes authoritative model catalog exploration, default model indicators,
//! and the Step 30 manual model override configuration with preflight capability validation.
*/

import React, { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Search,
  Sparkles,
  Check,
  X,
} from "lucide-react";
import {
  setAppSetting,
  validateManualOverride,
  type AppSettingsSnapshot,
  type ModelSettingsSummaryDto,
  type OverrideValidationResultDto,
  type ProviderSettingsSummaryDto,
  type RoutingPolicyConfigDto,
} from "../../../services/ipc";
import { formatTokenCount } from "../settingsFormatters";

interface ModelsAndRoutingPanelProps {
  appSettings: AppSettingsSnapshot;
  providers: ProviderSettingsSummaryDto[];
  models: ModelSettingsSummaryDto[];
  routingPolicy: RoutingPolicyConfigDto;
  onRefresh: () => Promise<void>;
}

export const ModelsAndRoutingPanel: React.FC<ModelsAndRoutingPanelProps> = ({
  appSettings,
  providers,
  models,
  onRefresh,
}) => {
  const [modelSearch, setModelSearch] = useState("");
  const [selectedProviderFilter, setSelectedProviderFilter] = useState<string>("all");

  // Manual Override State
  const initialOverrideActive = appSettings.manualOverrideEnabled ?? false;
  const [overrideMode, setOverrideMode] = useState<"auto" | "manual">(
    initialOverrideActive ? "manual" : "auto"
  );
  const [selectedProviderId, setSelectedProviderId] = useState<string>(
    appSettings.manualOverrideProvider || providers[0]?.providerId || "openai"
  );
  const [selectedModelId, setSelectedModelId] = useState<string>(
    appSettings.manualOverrideModel ||
      models.find((m) => m.providerId === selectedProviderId)?.modelId ||
      ""
  );

  const [validationResult, setValidationResult] = useState<OverrideValidationResultDto | null>(null);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  // Filtered models for catalog table
  const filteredModels = useMemo(() => {
    const q = modelSearch.toLowerCase().trim();
    return models.filter((m) => {
      const matchProvider =
        selectedProviderFilter === "all" || m.providerId === selectedProviderFilter;
      const matchQuery =
        !q ||
        m.displayName.toLowerCase().includes(q) ||
        m.modelId.toLowerCase().includes(q) ||
        m.providerId.toLowerCase().includes(q);
      return matchProvider && matchQuery;
    });
  }, [models, modelSearch, selectedProviderFilter]);

  // Models available for selected provider in manual override
  const providerModels = useMemo(() => {
    return models.filter((m) => m.providerId === selectedProviderId);
  }, [models, selectedProviderId]);

  // When provider changes in manual override, auto-select its default model
  const handleProviderChange = (newProviderId: string) => {
    setSelectedProviderId(newProviderId);
    const providerObj = providers.find((p) => p.providerId === newProviderId);
    const defModelId =
      providerObj?.defaultModelId ||
      models.find((m) => m.providerId === newProviderId)?.modelId ||
      "";
    setSelectedModelId(defModelId);
    setValidationResult(null);
  };

  // Run live capability validation
  const handleValidateOverride = async () => {
    if (!selectedProviderId || !selectedModelId) return;
    try {
      setValidating(true);
      const res = await validateManualOverride({
        provider_id: selectedProviderId,
        model_id: selectedModelId,
        enabled: true,
      });
      setValidationResult(res);
    } catch (err: unknown) {
      setValidationResult({
        is_valid: false,
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setValidating(false);
    }
  };

  // Save Manual Override preference
  const handleSaveOverride = async () => {
    if (!selectedProviderId || !selectedModelId) return;
    try {
      setSaving(true);
      await setAppSetting("routing.manual_override_enabled", "true");
      await setAppSetting("routing.manual_override_provider", selectedProviderId);
      await setAppSetting("routing.manual_override_model", selectedModelId);
      await onRefresh();
      showNotice(`Manual model override set to ${selectedProviderId} / ${selectedModelId}.`);
    } catch (err: unknown) {
      showNotice(`Failed to save override: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  // Clear Override / Restore Automatic Routing
  const handleClearOverride = async () => {
    try {
      setSaving(true);
      await setAppSetting("routing.manual_override_enabled", "false");
      await setAppSetting("routing.manual_override_provider", "");
      await setAppSetting("routing.manual_override_model", "");
      setOverrideMode("auto");
      setValidationResult(null);
      await onRefresh();
      showNotice("Restored Automatic Routing. SLM classifier will select models dynamically.");
    } catch (err: unknown) {
      showNotice(`Failed to clear override: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const isOverrideCurrentlyActive = appSettings.manualOverrideEnabled;

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

      {/* Routing Mode & Manual Model Override Section */}
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
            Routing Mode & Model Override
          </h2>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", margin: "0 0 1.25rem 0" }}>
          Choose between dynamic SLM-driven routing across all active providers or pin a specific manual model.
        </p>

        {/* Mode Selector Radio Tabs */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.75rem",
            marginBottom: "1.25rem",
          }}
        >
          <button
            type="button"
            onClick={() => setOverrideMode("auto")}
            style={{
              padding: "1rem",
              borderRadius: "0.5rem",
              textAlign: "left",
              background: overrideMode === "auto" ? "rgba(168, 85, 247, 0.12)" : "var(--nr-surface-raised)",
              border: overrideMode === "auto" ? "1.5px solid var(--nr-accent-purple)" : "1px solid var(--nr-border-subtle)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
              <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                Automatic Routing (SLM)
              </span>
              {!isOverrideCurrentlyActive && (
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "9999px",
                    background: "#22c55e",
                    color: "#fff",
                  }}
                >
                  Active
                </span>
              )}
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", margin: 0 }}>
              Evaluates task complexity, domain, and candidate scores on every request to select the optimal model.
            </p>
          </button>

          <button
            type="button"
            onClick={() => setOverrideMode("manual")}
            style={{
              padding: "1rem",
              borderRadius: "0.5rem",
              textAlign: "left",
              background: overrideMode === "manual" ? "rgba(168, 85, 247, 0.12)" : "var(--nr-surface-raised)",
              border: overrideMode === "manual" ? "1.5px solid var(--nr-accent-purple)" : "1px solid var(--nr-border-subtle)",
              cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.35rem" }}>
              <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                Manual Model Override
              </span>
              {isOverrideCurrentlyActive && (
                <span
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    padding: "0.15rem 0.5rem",
                    borderRadius: "9999px",
                    background: "var(--nr-accent-purple)",
                    color: "#fff",
                  }}
                >
                  Active
                </span>
              )}
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)", margin: 0 }}>
              Direct all incoming prompts to a specific provider and model without dynamic scoring.
            </p>
          </button>
        </div>

        {/* Manual Override Configuration Subpanel */}
        {overrideMode === "manual" ? (
          <div
            style={{
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
              borderRadius: "0.5rem",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {/* Informational Policy Alert */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.625rem",
                padding: "0.75rem 1rem",
                borderRadius: "0.375rem",
                background: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.25)",
                fontSize: "0.8125rem",
                color: "var(--nr-text-primary)",
              }}
            >
              <AlertCircle style={{ width: "16px", height: "16px", color: "#60a5fa", flexShrink: 0, marginTop: "2px" }} />
              <div>
                Manual selection affects routing preference. Runtime availability, capability, context, and security checks still apply.
              </div>
            </div>

            {/* Provider and Model Selectors */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label
                  htmlFor="override-provider-select"
                  style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--nr-text-primary)", marginBottom: "0.375rem" }}
                >
                  Provider
                </label>
                <select
                  id="override-provider-select"
                  value={selectedProviderId}
                  onChange={(e) => handleProviderChange(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.75rem",
                    borderRadius: "0.375rem",
                    background: "var(--nr-surface-card)",
                    border: "1px solid var(--nr-border-subtle)",
                    color: "var(--nr-text-primary)",
                    fontSize: "0.875rem",
                    outline: "none",
                  }}
                >
                  {providers.map((p) => (
                    <option key={p.providerId} value={p.providerId}>
                      {p.displayName} {!p.isConfigured ? "(No Key)" : !p.isActive ? "(Disabled)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="override-model-select"
                  style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--nr-text-primary)", marginBottom: "0.375rem" }}
                >
                  Model
                </label>
                <select
                  id="override-model-select"
                  value={selectedModelId}
                  onChange={(e) => {
                    setSelectedModelId(e.target.value);
                    setValidationResult(null);
                  }}
                  style={{
                    width: "100%",
                    padding: "0.625rem 0.75rem",
                    borderRadius: "0.375rem",
                    background: "var(--nr-surface-card)",
                    border: "1px solid var(--nr-border-subtle)",
                    color: "var(--nr-text-primary)",
                    fontSize: "0.875rem",
                    outline: "none",
                  }}
                >
                  {providerModels.map((m) => (
                    <option key={m.modelId} value={m.modelId}>
                      {m.displayName} ({formatTokenCount(m.contextWindow)}) {m.isDefault ? "★ Default" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Validation Feedback */}
            {validationResult && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "0.375rem",
                  background: validationResult.is_valid
                    ? "rgba(34, 197, 94, 0.1)"
                    : "rgba(239, 68, 68, 0.1)",
                  border: validationResult.is_valid
                    ? "1px solid rgba(34, 197, 94, 0.3)"
                    : "1px solid rgba(239, 68, 68, 0.3)",
                  fontSize: "0.8125rem",
                  color: "var(--nr-text-primary)",
                }}
              >
                {validationResult.is_valid ? (
                  <Check style={{ width: "16px", height: "16px", color: "#4ade80" }} />
                ) : (
                  <X style={{ width: "16px", height: "16px", color: "#f87171" }} />
                )}
                <span>{validationResult.message}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={handleValidateOverride}
                disabled={validating}
                style={{
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  background: "var(--nr-surface-card)",
                  border: "1px solid var(--nr-border-subtle)",
                  color: "var(--nr-text-primary)",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                {validating ? "Validating..." : "Validate Candidate"}
              </button>

              <button
                type="button"
                onClick={handleSaveOverride}
                disabled={saving}
                style={{
                  padding: "0.5rem 1.25rem",
                  borderRadius: "0.375rem",
                  background: "var(--nr-accent-purple)",
                  border: "none",
                  color: "#fff",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {saving ? "Saving..." : "Save Manual Override"}
              </button>

              {isOverrideCurrentlyActive && (
                <button
                  type="button"
                  onClick={handleClearOverride}
                  disabled={saving}
                  style={{
                    padding: "0.5rem 1rem",
                    borderRadius: "0.375rem",
                    background: "transparent",
                    border: "1px solid var(--nr-border-subtle)",
                    color: "var(--nr-text-secondary)",
                    fontSize: "0.875rem",
                    cursor: "pointer",
                    marginLeft: "auto",
                  }}
                >
                  Clear Override (Use Automatic Routing)
                </button>
              )}
            </div>
          </div>
        ) : (
          isOverrideCurrentlyActive && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1rem",
                borderRadius: "0.375rem",
                background: "rgba(234, 179, 8, 0.1)",
                border: "1px solid rgba(234, 179, 8, 0.25)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <AlertTriangle style={{ width: "16px", height: "16px", color: "#facc15" }} />
                <span style={{ fontSize: "0.8125rem", color: "var(--nr-text-primary)" }}>
                  A manual override (<strong>{appSettings.manualOverrideProvider} / {appSettings.manualOverrideModel}</strong>) is currently saved.
                </span>
              </div>
              <button
                type="button"
                onClick={handleClearOverride}
                disabled={saving}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "0.25rem",
                  background: "var(--nr-accent-purple)",
                  border: "none",
                  color: "#fff",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Restore Automatic Routing Now
              </button>
            </div>
          )
        )}
      </section>

      {/* Model Catalog Explorer Section */}
      <section
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Cpu style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple)" }} />
            <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--nr-text-primary)", margin: 0 }}>
              Registered Model Catalog ({models.length})
            </h2>
          </div>
        </div>
        <p style={{ fontSize: "0.875rem", color: "var(--nr-text-secondary)", margin: "0 0 1rem 0" }}>
          Authoritative static registry of all supported AI models, context headroom, and verified capabilities.
        </p>

        {/* Filter controls */}
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
            <Search
              style={{
                position: "absolute",
                left: "0.75rem",
                top: "50%",
                transform: "translateY(-50%)",
                width: "14px",
                height: "14px",
                color: "var(--nr-text-secondary)",
              }}
            />
            <input
              type="text"
              placeholder="Search models by name or ID..."
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem 0.5rem 2.25rem",
                borderRadius: "0.375rem",
                background: "var(--nr-surface-raised)",
                border: "1px solid var(--nr-border-subtle)",
                color: "var(--nr-text-primary)",
                fontSize: "0.8125rem",
                outline: "none",
              }}
            />
          </div>

          <select
            value={selectedProviderFilter}
            onChange={(e) => setSelectedProviderFilter(e.target.value)}
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              background: "var(--nr-surface-raised)",
              border: "1px solid var(--nr-border-subtle)",
              color: "var(--nr-text-primary)",
              fontSize: "0.8125rem",
              outline: "none",
            }}
          >
            <option value="all">All Providers ({providers.length})</option>
            {providers.map((p) => (
              <option key={p.providerId} value={p.providerId}>
                {p.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Model Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "0.75rem" }}>
          {filteredModels.map((m) => {
            const provider = providers.find((p) => p.providerId === m.providerId);
            return (
              <div
                key={`${m.providerId}-${m.modelId}`}
                style={{
                  padding: "0.875rem",
                  borderRadius: "0.5rem",
                  background: "var(--nr-surface-raised)",
                  border: "1px solid var(--nr-border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                      {m.displayName}
                    </div>
                    <div style={{ fontSize: "0.75rem", fontFamily: "var(--nr-font-mono, monospace)", color: "var(--nr-text-secondary)" }}>
                      {m.modelId}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.25rem" }}>
                    {m.isDefault && (
                      <span
                        style={{
                          fontSize: "0.6875rem",
                          padding: "0.125rem 0.375rem",
                          borderRadius: "0.25rem",
                          background: "rgba(168, 85, 247, 0.15)",
                          color: "var(--nr-accent-purple)",
                          fontWeight: 600,
                        }}
                      >
                        Default
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        padding: "0.125rem 0.375rem",
                        borderRadius: "0.25rem",
                        background: "var(--nr-surface-card)",
                        color: "var(--nr-text-secondary)",
                      }}
                    >
                      {provider?.displayName || m.providerId}
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>
                  <div>Context: <strong style={{ color: "var(--nr-text-primary)" }}>{formatTokenCount(m.contextWindow)}</strong></div>
                  <div>Max Output: <strong style={{ color: "var(--nr-text-primary)" }}>{formatTokenCount(m.maxOutputTokens)}</strong></div>
                </div>

                {/* Capabilities pills */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.25rem" }}>
                  {m.capabilities.map((c) => (
                    <span
                      key={c}
                      style={{
                        fontSize: "0.625rem",
                        padding: "0.1rem 0.35rem",
                        borderRadius: "0.2rem",
                        background: "rgba(255, 255, 255, 0.04)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        color: "var(--nr-text-secondary)",
                      }}
                    >
                      {c.replace("_", " ")}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
