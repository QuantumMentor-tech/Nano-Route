/**
 * Nano Route — Connectivity & Network Health Center Modal
 * File: src/features/connectivity/components/ConnectivityCenterModal.tsx
 *
 * Implements Step 86:
 * - Comprehensive inspection of local network state and provider reachability
 * - Distinct separation of Local SLM availability from remote endpoints
 * - Safe, manual, cancellable health check triggers
 * - Bounded transition history view
 * - Accessible Obsidian dark styling
 */

import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Wifi,
  WifiOff,
  AlertTriangle,
  RefreshCw,
  Cpu,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  KeyRound,
  History,
} from "lucide-react";
import {
  getConnectivitySnapshot,
  subscribeToConnectivity,
  checkProviderReachability,
  checkAllProviders,
} from "../engine.ts";
import type {
  ConnectivityStatusSnapshot,
  ProviderReachabilityRecord,
  ProviderReachabilityState,
} from "../types.ts";

export interface ConnectivityCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToSettings?: () => void;
}

export const ConnectivityCenterModal: React.FC<ConnectivityCenterModalProps> = ({
  isOpen,
  onClose,
  onNavigateToSettings,
}) => {
  const [snapshot, setSnapshot] = useState<ConnectivityStatusSnapshot>(getConnectivitySnapshot());
  const [isCheckingAll, setIsCheckingAll] = useState(false);
  const [checkingProviderId, setCheckingProviderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"providers" | "transitions">("providers");
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    setSnapshot(getConnectivitySnapshot());
    const unsubscribe = subscribeToConnectivity(() => {
      setSnapshot(getConnectivitySnapshot());
    });

    return () => {
      unsubscribe();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCheckAll = async () => {
    if (isCheckingAll) {
      // Cancel
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsCheckingAll(false);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsCheckingAll(true);

    try {
      await checkAllProviders(controller.signal);
    } catch {
      // Cancellation handled gracefully
    } finally {
      setIsCheckingAll(false);
      abortControllerRef.current = null;
    }
  };

  const handleCheckSingle = async (providerId: string) => {
    setCheckingProviderId(providerId);
    try {
      await checkProviderReachability(providerId);
    } finally {
      setCheckingProviderId(null);
    }
  };

  const getReachabilityBadge = (state: ProviderReachabilityState) => {
    switch (state) {
      case "REACHABLE":
        return {
          icon: <CheckCircle2 style={{ width: "12px", height: "12px" }} />,
          label: "Reachable",
          color: "#34d399",
          bg: "rgba(16, 185, 129, 0.12)",
          border: "#10b981",
        };
      case "UNREACHABLE":
        return {
          icon: <XCircle style={{ width: "12px", height: "12px" }} />,
          label: "Unreachable",
          color: "#f87171",
          bg: "rgba(239, 68, 68, 0.12)",
          border: "#ef4444",
        };
      case "AUTH_REQUIRED":
        return {
          icon: <KeyRound style={{ width: "12px", height: "12px" }} />,
          label: "Auth Required",
          color: "#fbbf24",
          bg: "rgba(245, 158, 11, 0.12)",
          border: "#f59e0b",
        };
      case "RATE_LIMITED":
        return {
          icon: <AlertTriangle style={{ width: "12px", height: "12px" }} />,
          label: "Rate Limited",
          color: "#fbbf24",
          bg: "rgba(245, 158, 11, 0.12)",
          border: "#f59e0b",
        };
      case "NOT_CONFIGURED":
        return {
          icon: <KeyRound style={{ width: "12px", height: "12px" }} />,
          label: "Not Configured",
          color: "#a1a1aa",
          bg: "rgba(161, 161, 170, 0.12)",
          border: "#71717a",
        };
      case "SERVICE_ERROR":
        return {
          icon: <AlertTriangle style={{ width: "12px", height: "12px" }} />,
          label: "Service Error",
          color: "#f87171",
          bg: "rgba(239, 68, 68, 0.12)",
          border: "#ef4444",
        };
      case "UNKNOWN":
      default:
        return {
          icon: <RefreshCw style={{ width: "12px", height: "12px" }} />,
          label: "Unknown",
          color: "#c084fc",
          bg: "rgba(168, 85, 247, 0.12)",
          border: "#a855f7",
        };
    }
  };

  const providersList = Object.values(snapshot.providers);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="conn-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.78)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1350,
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "780px",
          height: "80vh",
          maxHeight: "640px",
          backgroundColor: "var(--nr-bg-surface, #14171f)",
          border: "1px solid var(--nr-border-default, #27272a)",
          borderRadius: "var(--nr-radius-lg, 8px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 25px 30px -5px rgba(0, 0, 0, 0.6)",
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
            <Wifi style={{ width: "20px", height: "20px", color: "var(--nr-accent-blue, #60a5fa)" }} />
            <div>
              <h2 id="conn-modal-title" style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>
                Connectivity & Network Health
              </h2>
              <span style={{ fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>
                Local network state, provider reachability & offline resilience
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close Connectivity Center"
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

        {/* Global Network Overview Banner */}
        <div
          style={{
            padding: "0.85rem 1.25rem",
            backgroundColor:
              snapshot.networkState === "ONLINE"
                ? "rgba(16, 185, 129, 0.08)"
                : snapshot.networkState === "OFFLINE"
                ? "rgba(239, 68, 68, 0.08)"
                : "rgba(245, 158, 11, 0.08)",
            borderBottom: "1px solid var(--nr-border-default, #27272a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {snapshot.networkState === "ONLINE" ? (
              <Wifi style={{ width: "22px", height: "22px", color: "#10b981" }} />
            ) : snapshot.networkState === "OFFLINE" ? (
              <WifiOff style={{ width: "22px", height: "22px", color: "#ef4444" }} />
            ) : (
              <AlertTriangle style={{ width: "22px", height: "22px", color: "#f59e0b" }} />
            )}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>
                  Network: {snapshot.networkState}
                </span>
              </div>
              <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.75rem", color: "var(--nr-text-secondary, #d4d4d8)" }}>
                {snapshot.networkState === "ONLINE"
                  ? "Local network interface is connected. Remote AI provider endpoints are permitted."
                  : snapshot.networkState === "OFFLINE"
                  ? "Local network connection is disconnected. Remote provider requests are blocked to prevent failures."
                  : "Network connectivity is degraded or transitioning. Some endpoints may fail."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCheckAll}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.35rem 0.75rem",
              borderRadius: "4px",
              backgroundColor: isCheckingAll ? "rgba(239, 68, 68, 0.2)" : "var(--nr-accent-primary, #3b82f6)",
              border: "1px solid transparent",
              color: "#ffffff",
              fontSize: "0.75rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <RefreshCw
              style={{
                width: "12px",
                height: "12px",
                animation: isCheckingAll ? "spin 1.5s linear infinite" : "none",
              }}
            />
            <span>{isCheckingAll ? "Cancel Check" : "Check All Providers"}</span>
          </button>
        </div>

        {/* Local SLM Status Callout */}
        <div
          style={{
            margin: "0.85rem 1.25rem 0 1.25rem",
            padding: "0.65rem 0.85rem",
            borderRadius: "6px",
            backgroundColor: "rgba(96, 165, 250, 0.08)",
            border: "1px solid rgba(96, 165, 250, 0.25)",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
          }}
        >
          <Cpu style={{ width: "18px", height: "18px", color: "#60a5fa", flexShrink: 0 }} />
          <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary, #e4e4e7)" }}>
            <span style={{ fontWeight: 600, color: "#93c5fd" }}>Local SLM Runtime: </span>
            Operates completely on-device. Local inference, chat history, drafts, attachments, templates, and presets remain fully operational during network outages.
          </div>
        </div>

        {/* Tabs Bar */}
        <div
          style={{
            display: "flex",
            gap: "1rem",
            padding: "0.75rem 1.25rem 0 1.25rem",
            borderBottom: "1px solid var(--nr-border-default, #27272a)",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("providers")}
            style={{
              padding: "0.4rem 0.6rem",
              border: "none",
              borderBottom: activeTab === "providers" ? "2px solid #60a5fa" : "2px solid transparent",
              backgroundColor: "transparent",
              color: activeTab === "providers" ? "#ffffff" : "var(--nr-text-muted, #71717a)",
              fontWeight: 500,
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Provider Reachability ({providersList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("transitions")}
            style={{
              padding: "0.4rem 0.6rem",
              border: "none",
              borderBottom: activeTab === "transitions" ? "2px solid #60a5fa" : "2px solid transparent",
              backgroundColor: "transparent",
              color: activeTab === "transitions" ? "#ffffff" : "var(--nr-text-muted, #71717a)",
              fontWeight: 500,
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Transition History ({snapshot.recentTransitions.length})
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem" }}>
          {activeTab === "providers" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {providersList.map((record: ProviderReachabilityRecord) => {
                const badge = getReachabilityBadge(record.state);
                const isChecking = checkingProviderId === record.providerId;

                return (
                  <div
                    key={record.providerId}
                    style={{
                      padding: "0.65rem 0.85rem",
                      borderRadius: "6px",
                      backgroundColor: "var(--nr-bg-surface-elevated, #1c1f2a)",
                      border: "1px solid var(--nr-border-subtle, #27272a)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      {record.isLocal ? (
                        <Cpu style={{ width: "16px", height: "16px", color: "#60a5fa" }} />
                      ) : (
                        <ShieldCheck style={{ width: "16px", height: "16px", color: "#a1a1aa" }} />
                      )}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{record.displayName}</span>
                          {record.isLocal && (
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
                        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.2rem", fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>
                          {record.lastCheckedAtMs ? (
                            <span>Checked {Math.round((Date.now() - record.lastCheckedAtMs) / 1000)}s ago</span>
                          ) : (
                            <span>Not checked yet</span>
                          )}
                          {record.latencyMs !== null && (
                            <span>• {record.latencyMs}ms</span>
                          )}
                          {record.errorMessage && (
                            <span style={{ color: "#f87171" }}>• {record.errorMessage}</span>
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

                      {!record.isLocal && (
                        <button
                          type="button"
                          onClick={() => handleCheckSingle(record.providerId)}
                          disabled={isChecking}
                          style={{
                            padding: "0.25rem 0.5rem",
                            borderRadius: "4px",
                            backgroundColor: "transparent",
                            border: "1px solid var(--nr-border-default, #27272a)",
                            color: "var(--nr-text-secondary, #d4d4d8)",
                            fontSize: "0.7rem",
                            cursor: isChecking ? "default" : "pointer",
                          }}
                        >
                          {isChecking ? "Checking..." : "Check"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {snapshot.recentTransitions.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--nr-text-muted, #71717a)", padding: "2rem", fontSize: "0.8rem" }}>
                  No network transitions recorded during this session.
                </div>
              ) : (
                snapshot.recentTransitions.map((t) => (
                  <div
                    key={t.id}
                    style={{
                      padding: "0.6rem 0.8rem",
                      borderRadius: "6px",
                      backgroundColor: "var(--nr-bg-surface-elevated, #1c1f2a)",
                      border: "1px solid var(--nr-border-subtle, #27272a)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "0.75rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <History style={{ width: "14px", height: "14px", color: "var(--nr-text-muted, #71717a)" }} />
                      <span>
                        <span style={{ fontWeight: 600 }}>{t.from}</span> → <span style={{ fontWeight: 600 }}>{t.to}</span>
                      </span>
                      <span style={{ color: "var(--nr-text-muted, #71717a)" }}>({t.reason})</span>
                    </div>
                    <span style={{ color: "var(--nr-text-muted, #71717a)", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <Clock style={{ width: "12px", height: "12px" }} />
                      <span>{new Date(t.timestampMs).toLocaleTimeString()}</span>
                    </span>
                  </div>
                ))
              )}
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
          <span>Privacy: Zero request payloads or credentials are sent during health checks.</span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {onNavigateToSettings && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToSettings();
                }}
                style={{
                  padding: "0.3rem 0.8rem",
                  borderRadius: "4px",
                  backgroundColor: "transparent",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                  cursor: "pointer",
                }}
              >
                Provider Settings
              </button>
            )}
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
    </div>
  );
};
