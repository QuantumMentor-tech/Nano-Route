/**
 * Nano Route — Provider & Model Compatibility Center Modal
 * File: src/features/provider-compatibility/components/CompatibilityCenterModal.tsx
 *
 * Implements Step 87:
 * - Single-pane-of-glass readiness, capability, and compatibility explorer
 * - Side-by-side model comparison matrix
 * - Request-specific eligibility evaluation with plain-language explanations
 * - Deep links to Provider Settings and Connectivity Center
 * - Accessible Obsidian dark interface with full keyboard and screen-reader support
 */

import React, { useState, useEffect } from "react";
import {
  X,
  ShieldCheck,
  Cpu,
  Search,
  Eye,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ExternalLink,
  Layers,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import {
  getCompatibilitySnapshot,
  filterModels,
  buildModelComparison,
  subscribeToCompatibility,
} from "../engine.ts";
import type {
  ProviderCompatibilityRecord,
  ModelCompatibilityRecord,
  ReadinessState,
  RequestRequirements,
  CompatibilityFilter,
  ModelComparisonItem,
} from "../types.ts";

export interface CompatibilityCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  requestRequirements?: RequestRequirements;
  onNavigateToSettings?: () => void;
  onNavigateToConnectivity?: () => void;
}

export const CompatibilityCenterModal: React.FC<CompatibilityCenterModalProps> = ({
  isOpen,
  onClose,
  requestRequirements,
  onNavigateToSettings,
  onNavigateToConnectivity,
}) => {
  const [providers, setProviders] = useState<ProviderCompatibilityRecord[]>([]);
  const [models, setModels] = useState<ModelCompatibilityRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "models" | "compare" | "request">("overview");
  const [filter, setFilter] = useState<CompatibilityFilter>({ search: "", readiness: "ALL", modality: "all" });
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [expandedReasonsModelId, setExpandedReasonsModelId] = useState<string | null>(null);

  const refreshData = async () => {
    const snap = await getCompatibilitySnapshot(requestRequirements, true);
    setProviders(snap.providers);
    setModels(snap.models);
  };

  useEffect(() => {
    if (!isOpen) return;
    refreshData();
    const unsubscribe = subscribeToCompatibility(() => {
      getCompatibilitySnapshot(requestRequirements).then((snap) => {
        setProviders(snap.providers);
        setModels(snap.models);
      });
    });
    return () => unsubscribe();
  }, [isOpen, requestRequirements]);

  if (!isOpen) return null;

  const filteredModels = filterModels(models, filter);

  const getReadinessBadge = (state: ReadinessState) => {
    switch (state) {
      case "READY":
        return {
          icon: <CheckCircle2 style={{ width: "12px", height: "12px" }} />,
          label: "Ready",
          color: "#34d399",
          bg: "rgba(16, 185, 129, 0.12)",
          border: "#10b981",
        };
      case "READY_WITH_LIMITATIONS":
        return {
          icon: <AlertTriangle style={{ width: "12px", height: "12px" }} />,
          label: "Limitations",
          color: "#fbbf24",
          bg: "rgba(245, 158, 11, 0.12)",
          border: "#f59e0b",
        };
      case "NOT_CONFIGURED":
        return {
          icon: <AlertTriangle style={{ width: "12px", height: "12px" }} />,
          label: "No API Key",
          color: "#a1a1aa",
          bg: "rgba(161, 161, 170, 0.12)",
          border: "#71717a",
        };
      case "AUTH_REQUIRED":
        return {
          icon: <XCircle style={{ width: "12px", height: "12px" }} />,
          label: "Auth Required",
          color: "#f87171",
          bg: "rgba(239, 68, 68, 0.12)",
          border: "#ef4444",
        };
      case "OFFLINE":
        return {
          icon: <XCircle style={{ width: "12px", height: "12px" }} />,
          label: "Offline",
          color: "#f87171",
          bg: "rgba(239, 68, 68, 0.12)",
          border: "#ef4444",
        };
      case "UNAVAILABLE":
        return {
          icon: <XCircle style={{ width: "12px", height: "12px" }} />,
          label: "Outage",
          color: "#f87171",
          bg: "rgba(239, 68, 68, 0.12)",
          border: "#ef4444",
        };
      case "INCOMPATIBLE":
        return {
          icon: <XCircle style={{ width: "12px", height: "12px" }} />,
          label: "Incompatible",
          color: "#f87171",
          bg: "rgba(239, 68, 68, 0.12)",
          border: "#ef4444",
        };
      case "DEPRECATED":
        return {
          icon: <Clock style={{ width: "12px", height: "12px" }} />,
          label: "Deprecated",
          color: "#fbbf24",
          bg: "rgba(245, 158, 11, 0.12)",
          border: "#f59e0b",
        };
      case "DISABLED":
        return {
          icon: <XCircle style={{ width: "12px", height: "12px" }} />,
          label: "Disabled",
          color: "#71717a",
          bg: "rgba(113, 113, 122, 0.12)",
          border: "#52525b",
        };
      case "UNKNOWN":
      default:
        return {
          icon: <AlertTriangle style={{ width: "12px", height: "12px" }} />,
          label: "Unknown",
          color: "#c084fc",
          bg: "rgba(168, 85, 247, 0.12)",
          border: "#a855f7",
        };
    }
  };

  const toggleCompare = (mid: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(mid)) {
        return prev.filter((id) => id !== mid);
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), mid];
      }
      return [...prev, mid];
    });
  };

  const comparedModels: ModelComparisonItem[] = buildModelComparison(
    models.filter((m) => selectedForCompare.includes(`${m.providerId}/${m.modelId}`))
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="compat-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1400,
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "960px",
          height: "86vh",
          maxHeight: "720px",
          backgroundColor: "var(--nr-bg-surface, #14171f)",
          border: "1px solid var(--nr-border-default, #27272a)",
          borderRadius: "var(--nr-radius-lg, 8px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 35px -5px rgba(0, 0, 0, 0.7)",
          color: "var(--nr-text-primary, #ffffff)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderBottom: "1px solid var(--nr-border-default, #27272a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Layers style={{ width: "20px", height: "20px", color: "var(--nr-accent-purple, #a855f7)" }} />
            <div>
              <h2 id="compat-modal-title" style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>
                Provider & Model Compatibility Center
              </h2>
              <span style={{ fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>
                Authoritative capability matrix, readiness diagnostics & request eligibility
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Compatibility Center"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--nr-text-muted, #71717a)",
              cursor: "pointer",
              padding: "0.25rem",
            }}
          >
            <X style={{ width: "18px", height: "18px" }} />
          </button>
        </div>

        {/* Tabs Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.5rem 1.25rem 0 1.25rem",
            borderBottom: "1px solid var(--nr-border-default, #27272a)",
            backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
          }}
        >
          <div style={{ display: "flex", gap: "0.85rem" }}>
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              style={{
                padding: "0.45rem 0.65rem",
                border: "none",
                borderBottom: activeTab === "overview" ? "2px solid #a855f7" : "2px solid transparent",
                backgroundColor: "transparent",
                color: activeTab === "overview" ? "#ffffff" : "var(--nr-text-muted, #71717a)",
                fontWeight: 500,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Providers ({providers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("models")}
              style={{
                padding: "0.45rem 0.65rem",
                border: "none",
                borderBottom: activeTab === "models" ? "2px solid #a855f7" : "2px solid transparent",
                backgroundColor: "transparent",
                color: activeTab === "models" ? "#ffffff" : "var(--nr-text-muted, #71717a)",
                fontWeight: 500,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Model Catalog ({models.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("compare")}
              style={{
                padding: "0.45rem 0.65rem",
                border: "none",
                borderBottom: activeTab === "compare" ? "2px solid #a855f7" : "2px solid transparent",
                backgroundColor: "transparent",
                color: activeTab === "compare" ? "#ffffff" : "var(--nr-text-muted, #71717a)",
                fontWeight: 500,
                fontSize: "0.8rem",
                cursor: "pointer",
              }}
            >
              Compare ({selectedForCompare.length})
            </button>
            {requestRequirements && (
              <button
                type="button"
                onClick={() => setActiveTab("request")}
                style={{
                  padding: "0.45rem 0.65rem",
                  border: "none",
                  borderBottom: activeTab === "request" ? "2px solid #a855f7" : "2px solid transparent",
                  backgroundColor: "transparent",
                  color: activeTab === "request" ? "#ffffff" : "var(--nr-text-muted, #71717a)",
                  fontWeight: 500,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}
              >
                <Sparkles style={{ width: "12px", height: "12px", color: "#60a5fa" }} />
                <span>Current Request Eligibility</span>
              </button>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingBottom: "0.35rem" }}>
            {onNavigateToConnectivity && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToConnectivity();
                }}
                style={{
                  padding: "0.25rem 0.55rem",
                  borderRadius: "4px",
                  backgroundColor: "transparent",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  color: "var(--nr-text-secondary, #d4d4d8)",
                  fontSize: "0.7rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <span>Network Status</span>
                <ExternalLink style={{ width: "10px", height: "10px" }} />
              </button>
            )}
            {onNavigateToSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToSettings();
                }}
                style={{
                  padding: "0.25rem 0.55rem",
                  borderRadius: "4px",
                  backgroundColor: "transparent",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  color: "var(--nr-text-secondary, #d4d4d8)",
                  fontSize: "0.7rem",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.25rem",
                }}
              >
                <span>Provider Settings</span>
                <ExternalLink style={{ width: "10px", height: "10px" }} />
              </button>
            )}
          </div>
        </div>

        {/* Content Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem" }}>
          {/* TAB 1: OVERVIEW & PROVIDERS */}
          {activeTab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
              {providers.map((p) => {
                const badge = getReadinessBadge(p.readiness);

                return (
                  <div
                    key={p.providerId}
                    style={{
                      padding: "0.85rem 1rem",
                      borderRadius: "6px",
                      backgroundColor: "var(--nr-bg-surface-elevated, #1c1f2a)",
                      border: "1px solid var(--nr-border-subtle, #27272a)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        {p.isLocal ? (
                          <Cpu style={{ width: "18px", height: "18px", color: "#60a5fa" }} />
                        ) : (
                          <ShieldCheck style={{ width: "18px", height: "18px", color: "#a855f7" }} />
                        )}
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>{p.displayName}</span>
                            {p.isLocal && (
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  padding: "0.1rem 0.35rem",
                                  borderRadius: "4px",
                                  backgroundColor: "rgba(96, 165, 250, 0.15)",
                                  color: "#60a5fa",
                                }}
                              >
                                On-Device
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}>
                            {p.description}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            padding: "0.2rem 0.55rem",
                            borderRadius: "12px",
                            fontSize: "0.7rem",
                            fontWeight: 500,
                            color: badge.color,
                            backgroundColor: badge.bg,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      </div>
                    </div>

                    {/* Component Readiness Breakdown */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                        padding: "0.45rem 0.65rem",
                        borderRadius: "4px",
                        backgroundColor: "rgba(0, 0, 0, 0.2)",
                        fontSize: "0.7rem",
                        color: "var(--nr-text-secondary, #d4d4d8)",
                      }}
                    >
                      <div>
                        <span style={{ color: "var(--nr-text-muted, #71717a)" }}>Credential: </span>
                        <span style={{ fontWeight: 500 }}>{p.credentialStatus}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--nr-text-muted, #71717a)" }}>Network: </span>
                        <span style={{ fontWeight: 500 }}>{p.connectivityStatus}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--nr-text-muted, #71717a)" }}>Health: </span>
                        <span style={{ fontWeight: 500 }}>{p.healthStatus}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--nr-text-muted, #71717a)" }}>Registered Models: </span>
                        <span style={{ fontWeight: 500 }}>{p.modelsCount}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TAB 2: MODEL CATALOG */}
          {activeTab === "models" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {/* Search & Filters */}
              <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search
                    style={{
                      position: "absolute",
                      left: "0.6rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: "14px",
                      height: "14px",
                      color: "var(--nr-text-muted, #71717a)",
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search models, capabilities, or providers..."
                    value={filter.search || ""}
                    onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "0.4rem 0.6rem 0.4rem 2rem",
                      borderRadius: "4px",
                      backgroundColor: "var(--nr-bg-surface-elevated, #1c1f2a)",
                      border: "1px solid var(--nr-border-default, #27272a)",
                      color: "#ffffff",
                      fontSize: "0.75rem",
                      outline: "none",
                    }}
                  />
                </div>

                <select
                  value={filter.modality || "all"}
                  onChange={(e) => setFilter({ ...filter, modality: e.target.value as any })}
                  style={{
                    padding: "0.4rem 0.6rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--nr-bg-surface-elevated, #1c1f2a)",
                    border: "1px solid var(--nr-border-default, #27272a)",
                    color: "var(--nr-text-primary, #ffffff)",
                    fontSize: "0.75rem",
                    outline: "none",
                  }}
                >
                  <option value="all">All Modalities</option>
                  <option value="image">Vision / Image Capable</option>
                  <option value="file">File Context Capable</option>
                </select>

                <select
                  value={filter.readiness || "ALL"}
                  onChange={(e) => setFilter({ ...filter, readiness: e.target.value as any })}
                  style={{
                    padding: "0.4rem 0.6rem",
                    borderRadius: "4px",
                    backgroundColor: "var(--nr-bg-surface-elevated, #1c1f2a)",
                    border: "1px solid var(--nr-border-default, #27272a)",
                    color: "var(--nr-text-primary, #ffffff)",
                    fontSize: "0.75rem",
                    outline: "none",
                  }}
                >
                  <option value="ALL">All Readiness States</option>
                  <option value="READY">Ready</option>
                  <option value="READY_WITH_LIMITATIONS">Ready (Limitations)</option>
                  <option value="NOT_CONFIGURED">Not Configured</option>
                  <option value="OFFLINE">Offline</option>
                </select>
              </div>

              {/* Models List */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                {filteredModels.map((m) => {
                  const badge = getReadinessBadge(m.readiness);
                  const compareKey = `${m.providerId}/${m.modelId}`;
                  const isCompared = selectedForCompare.includes(compareKey);

                  return (
                    <div
                      key={compareKey}
                      style={{
                        padding: "0.75rem 0.95rem",
                        borderRadius: "6px",
                        backgroundColor: "var(--nr-bg-surface-elevated, #1c1f2a)",
                        border: "1px solid var(--nr-border-subtle, #27272a)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <input
                          type="checkbox"
                          checked={isCompared}
                          onChange={() => toggleCompare(compareKey)}
                          title="Select to compare side-by-side"
                          style={{ cursor: "pointer" }}
                        />
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{m.displayName}</span>
                            <span style={{ fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>
                              ({m.providerId})
                            </span>
                            {m.isDefault && (
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  padding: "0.1rem 0.35rem",
                                  borderRadius: "4px",
                                  backgroundColor: "rgba(168, 85, 247, 0.15)",
                                  color: "#c084fc",
                                }}
                              >
                                Default
                              </span>
                            )}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                            <span
                              style={{
                                fontSize: "0.68rem",
                                padding: "0.1rem 0.4rem",
                                borderRadius: "4px",
                                backgroundColor: "rgba(255, 255, 255, 0.05)",
                                color: "var(--nr-text-secondary, #d4d4d8)",
                              }}
                            >
                              {(m.contextWindow / 1000).toFixed(0)}K Context
                            </span>
                            {m.supportsVision && (
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  padding: "0.1rem 0.4rem",
                                  borderRadius: "4px",
                                  backgroundColor: "rgba(96, 165, 250, 0.12)",
                                  color: "#60a5fa",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.2rem",
                                }}
                              >
                                <Eye style={{ width: "10px", height: "10px" }} />
                                <span>Vision</span>
                              </span>
                            )}
                            {m.supportsStreaming && (
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  padding: "0.1rem 0.4rem",
                                  borderRadius: "4px",
                                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                                  color: "#34d399",
                                }}
                              >
                                Streaming
                              </span>
                            )}
                            {m.supportsToolCalling && (
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  padding: "0.1rem 0.4rem",
                                  borderRadius: "4px",
                                  backgroundColor: "rgba(245, 158, 11, 0.12)",
                                  color: "#fbbf24",
                                }}
                              >
                                Tools
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "12px",
                            fontSize: "0.7rem",
                            fontWeight: 500,
                            color: badge.color,
                            backgroundColor: badge.bg,
                            border: `1px solid ${badge.border}`,
                          }}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: COMPARE MODELS */}
          {activeTab === "compare" && (
            <div>
              {comparedModels.length === 0 ? (
                <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--nr-text-muted, #71717a)" }}>
                  <Layers style={{ width: "32px", height: "32px", margin: "0 auto 0.75rem auto", opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: "0.85rem" }}>
                    No models selected for side-by-side comparison.
                  </p>
                  <span style={{ fontSize: "0.75rem" }}>
                    Select checkboxes on the Model Catalog tab to compare up to 4 models.
                  </span>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.75rem",
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--nr-border-default, #27272a)" }}>
                        <th style={{ padding: "0.5rem", color: "var(--nr-text-muted, #71717a)" }}>Feature</th>
                        {comparedModels.map((m) => (
                          <th key={`${m.providerId}/${m.modelId}`} style={{ padding: "0.5rem", fontWeight: 600 }}>
                            {m.displayName}
                            <div style={{ fontSize: "0.65rem", color: "var(--nr-text-muted, #71717a)" }}>
                              {m.providerId}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: "1px solid var(--nr-border-subtle, #1f232e)" }}>
                        <td style={{ padding: "0.5rem", color: "var(--nr-text-muted, #71717a)" }}>Context Window</td>
                        {comparedModels.map((m) => (
                          <td key={m.modelId} style={{ padding: "0.5rem" }}>
                            {(m.contextWindow / 1000).toLocaleString()}K tokens
                          </td>
                        ))}
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--nr-border-subtle, #1f232e)" }}>
                        <td style={{ padding: "0.5rem", color: "var(--nr-text-muted, #71717a)" }}>Max Output</td>
                        {comparedModels.map((m) => (
                          <td key={m.modelId} style={{ padding: "0.5rem" }}>
                            {m.maxOutputTokens.toLocaleString()} tokens
                          </td>
                        ))}
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--nr-border-subtle, #1f232e)" }}>
                        <td style={{ padding: "0.5rem", color: "var(--nr-text-muted, #71717a)" }}>Modalities</td>
                        {comparedModels.map((m) => (
                          <td key={m.modelId} style={{ padding: "0.5rem" }}>
                            {m.modalities.join(", ")}
                          </td>
                        ))}
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--nr-border-subtle, #1f232e)" }}>
                        <td style={{ padding: "0.5rem", color: "var(--nr-text-muted, #71717a)" }}>Streaming</td>
                        {comparedModels.map((m) => (
                          <td key={m.modelId} style={{ padding: "0.5rem" }}>
                            {m.streaming ? "Yes" : "No"}
                          </td>
                        ))}
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--nr-border-subtle, #1f232e)" }}>
                        <td style={{ padding: "0.5rem", color: "var(--nr-text-muted, #71717a)" }}>Tools / Functions</td>
                        {comparedModels.map((m) => (
                          <td key={m.modelId} style={{ padding: "0.5rem" }}>
                            {m.tools ? "Yes" : "No"}
                          </td>
                        ))}
                      </tr>
                      <tr style={{ borderBottom: "1px solid var(--nr-border-subtle, #1f232e)" }}>
                        <td style={{ padding: "0.5rem", color: "var(--nr-text-muted, #71717a)" }}>Cost Estimate</td>
                        {comparedModels.map((m) => (
                          <td key={m.modelId} style={{ padding: "0.5rem" }}>
                            {m.costEstimate}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td style={{ padding: "0.5rem", color: "var(--nr-text-muted, #71717a)" }}>Readiness</td>
                        {comparedModels.map((m) => {
                          const badge = getReadinessBadge(m.readiness);
                          return (
                            <td key={m.modelId} style={{ padding: "0.5rem" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.25rem",
                                  padding: "0.15rem 0.45rem",
                                  borderRadius: "10px",
                                  fontSize: "0.68rem",
                                  color: badge.color,
                                  backgroundColor: badge.bg,
                                  border: `1px solid ${badge.border}`,
                                }}
                              >
                                {badge.icon}
                                <span>{badge.label}</span>
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CURRENT REQUEST ELIGIBILITY */}
          {activeTab === "request" && requestRequirements && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div
                style={{
                  padding: "0.75rem 0.95rem",
                  borderRadius: "6px",
                  backgroundColor: "rgba(96, 165, 250, 0.08)",
                  border: "1px solid rgba(96, 165, 250, 0.25)",
                  fontSize: "0.75rem",
                }}
              >
                <span style={{ fontWeight: 600, color: "#93c5fd" }}>Current Request Profile: </span>
                <span>
                  {requestRequirements.estimatedInputTokens?.toLocaleString() ?? 0} estimated tokens •{" "}
                  {requestRequirements.requiresImageInput ? "Requires Vision (Images) • " : "Text only • "}
                  {requestRequirements.requiresStreaming ? "Streaming mode" : "Standard mode"}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                {models.map((m) => {
                  const isEligible = m.isEligibleForCurrentRequest;
                  const isExpanded = expandedReasonsModelId === m.modelId;

                  return (
                    <div
                      key={`${m.providerId}/${m.modelId}`}
                      style={{
                        padding: "0.75rem 0.95rem",
                        borderRadius: "6px",
                        backgroundColor: "var(--nr-bg-surface-elevated, #1c1f2a)",
                        border: `1px solid ${
                          isEligible ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"
                        }`,
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.4rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          {isEligible ? (
                            <CheckCircle2 style={{ width: "16px", height: "16px", color: "#34d399" }} />
                          ) : (
                            <XCircle style={{ width: "16px", height: "16px", color: "#f87171" }} />
                          )}
                          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{m.displayName}</span>
                          <span style={{ fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>
                            ({m.providerId})
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            padding: "0.15rem 0.5rem",
                            borderRadius: "10px",
                            color: isEligible ? "#34d399" : "#f87171",
                            backgroundColor: isEligible
                              ? "rgba(16, 185, 129, 0.12)"
                              : "rgba(239, 68, 68, 0.12)",
                          }}
                        >
                          {isEligible ? "Eligible" : "Ineligible"}
                        </span>
                      </div>

                      {/* Explanation Reasons */}
                      <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary, #d4d4d8)" }}>
                        {m.eligibilityReasons.slice(0, isExpanded ? undefined : 1).map((r, idx) => (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            <ArrowRight style={{ width: "10px", height: "10px", color: "var(--nr-text-muted, #71717a)" }} />
                            <span>{r}</span>
                          </div>
                        ))}
                        {m.eligibilityReasons.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setExpandedReasonsModelId(isExpanded ? null : m.modelId)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--nr-accent-blue, #60a5fa)",
                              fontSize: "0.7rem",
                              cursor: "pointer",
                              padding: 0,
                              marginTop: "0.2rem",
                            }}
                          >
                            {isExpanded ? "Show less" : `+${m.eligibilityReasons.length - 1} more reasons`}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "0.75rem 1.25rem",
            borderTop: "1px solid var(--nr-border-default, #27272a)",
            backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            color: "var(--nr-text-muted, #71717a)",
          }}
        >
          <span>Authoritative capability map. Zero billable requests or prompt transmission.</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0.3rem 0.8rem",
              borderRadius: "4px",
              backgroundColor: "transparent",
              border: "1px solid var(--nr-border-default, #27272a)",
              color: "var(--nr-text-primary, #ffffff)",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
