/**
//! Nano Route — Step 45 Telemetry Audit, Data Cleanup, Retention & Privacy Control Panel
//! File: src/features/settings/components/PrivacyDataLifecyclePanel.tsx
//!
//! Provides the complete user-facing Data Lifecycle, Integrity Audit, Safe Repair,
//! Retention Policy, Targeted Cleanup (with Dry-Run Preview), and Full Local Data Wipe
//! workspace inside Settings & Security.
*/

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Eye,
  HardDrive,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Trash2,
  Wrench,
} from "lucide-react";
import {
  EXECUTE_FULL_WIPE_TOKEN_TEXT,
  formatCategoryBadge,
  formatDeletionPolicyBadge,
  formatHealthStateBadge,
} from "../privacyFormatters";
import {
  executeDataCleanup,
  executeFullDataWipe,
   FULL_WIPE_CONFIRMATION_TOKEN,
  getDataInventory,
  getRetentionPolicy,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  previewDataCleanup,
  previewFullDataWipe,
  runDataAudit,
  runSafeDataRepair,
  updateRetentionPolicy,
  type AuditCheckMode,
  type CleanupOperationResult,
  type CleanupPreviewResult,
  type CleanupTargetScope,
  type DataAuditReport,
  type DataInventorySnapshot,
  type FullWipePreviewResult,
  type FullWipeReport,
  type RetentionPolicyConfig,
  type SafeRepairResult,
} from "../../../services/ipc";

export const PrivacyDataLifecyclePanel: React.FC = () => {
  const [inventory, setInventory] = useState<DataInventorySnapshot | null>(null);
  const [auditReport, setAuditReport] = useState<DataAuditReport | null>(null);
  const [policy, setPolicy] = useState<RetentionPolicyConfig>({
    historyRetentionEnabled: false,
    historyRetentionDays: 30,
    excludePinnedSessions: true,
    telemetryRetentionEnabled: false,
    telemetryRetentionDays: 30,
    cleanupConfirmationRequired: true,
  });

  const [loading, setLoading] = useState<boolean>(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Repair & Cleanup results
  const [repairResult, setRepairResult] = useState<SafeRepairResult | null>(null);
  const [cleanupPreview, setCleanupPreview] =
    useState<CleanupPreviewResult | null>(null);
  const [pendingCleanupScope, setPendingCleanupScope] =
    useState<CleanupTargetScope | null>(null);
  const [pendingDeleteAll, setPendingDeleteAll] = useState<boolean>(false);
  const [pendingOlderThanDays, setPendingOlderThanDays] = useState<
    number | null
  >(null);
  const [cleanupResult, setCleanupResult] =
    useState<CleanupOperationResult | null>(null);

  // Full Wipe modal state
  const [wipeModalOpen, setWipeModalOpen] = useState<boolean>(false);
  const [wipePreview, setWipePreview] = useState<FullWipePreviewResult | null>(
    null
  );
  const [wipeConfirmInput, setWipeConfirmInput] = useState<string>("");
  const [wipeIncludeCredentials, setWipeIncludeCredentials] =
    useState<boolean>(true);
  const [wipeIncludeSettings, setWipeIncludeSettings] = useState<boolean>(true);
  const [wipeReport, setWipeReport] = useState<FullWipeReport | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const [inv, pol, audit] = await Promise.all([
        getDataInventory(),
        getRetentionPolicy(),
        runDataAudit("quick"),
      ]);
      setInventory(inv);
      setPolicy(pol);
      setAuditReport(audit);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to load local data lifecycle state"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const handleRunAudit = async (mode: AuditCheckMode) => {
    setBusyAction(`audit_${mode}`);
    setErrorMessage(null);
    try {
      const [audit, inv] = await Promise.all([
        runDataAudit(mode),
        getDataInventory(),
      ]);
      setAuditReport(audit);
      setInventory(inv);
      setStatusBanner(
        `Completed ${mode === "full" ? "Full Integrity & Privacy Audit" : "Quick Health Check"} in ${audit.durationMs} ms.`
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to run data audit"
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleSafeRepair = async () => {
    setBusyAction("repair");
    setErrorMessage(null);
    try {
      const res = await runSafeDataRepair(
        "remove_orphaned_records_and_rebuild_index"
      );
      setRepairResult(res);
      const [inv, audit] = await Promise.all([
        getDataInventory(),
        runDataAudit("full"),
      ]);
      setInventory(inv);
      setAuditReport(audit);
      setStatusBanner(res.message);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to run safe repair"
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusyAction("save_policy");
    setErrorMessage(null);
    try {
      const saved = await updateRetentionPolicy(policy);
      setPolicy(saved);
      const inv = await getDataInventory();
      setInventory(inv);
      setStatusBanner("Local retention policy saved.");
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to update retention policy"
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handlePreviewCleanup = async (
    scope: CleanupTargetScope,
    options: { deleteAll?: boolean; olderThanDays?: number | null } = {}
  ) => {
    setBusyAction(`preview_${scope}`);
    setErrorMessage(null);
    setCleanupResult(null);
    try {
      const preview = await previewDataCleanup({
        scope,
        olderThanDays: options.olderThanDays ?? null,
        excludePinnedSessions: policy.excludePinnedSessions,
        deleteAllInScope: options.deleteAll ?? false,
      });
      setCleanupPreview(preview);
      setPendingCleanupScope(scope);
      setPendingDeleteAll(Boolean(options.deleteAll));
      setPendingOlderThanDays(options.olderThanDays ?? null);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to compute cleanup preview"
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirmCleanup = async () => {
    if (!pendingCleanupScope) return;
    setBusyAction("execute_cleanup");
    setErrorMessage(null);
    try {
      const res = await executeDataCleanup({
        scope: pendingCleanupScope,
        olderThanDays: pendingOlderThanDays,
        excludePinnedSessions: policy.excludePinnedSessions,
        deleteAllInScope: pendingDeleteAll,
        confirmed: true,
      });
      setCleanupResult(res);
      setCleanupPreview(null);
      setPendingCleanupScope(null);
      const [inv, audit] = await Promise.all([
        getDataInventory(),
        runDataAudit("quick"),
      ]);
      setInventory(inv);
      setAuditReport(audit);
      setStatusBanner(
        `Cleanup completed: removed ${res.deletedSessionsCount} session(s), ${res.deletedMessagesCount} message(s), and ${res.deletedTelemetryRecordsCount} telemetry record(s).`
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to execute cleanup"
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenWipeModal = async () => {
    setBusyAction("preview_wipe");
    setErrorMessage(null);
    setWipeReport(null);
    setWipeConfirmInput("");
    try {
      const preview = await previewFullDataWipe();
      setWipePreview(preview);
      setWipeModalOpen(true);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to preview Full Local Data Wipe"
      );
    } finally {
      setBusyAction(null);
    }
  };

  const handleExecuteFullWipe = async () => {
    if (wipeConfirmInput !== FULL_WIPE_CONFIRMATION_TOKEN) return;
    setBusyAction("execute_wipe");
    setErrorMessage(null);
    try {
      const report = await executeFullDataWipe({
        confirmationToken: wipeConfirmInput,
        confirmed: true,
        includeCredentials: wipeIncludeCredentials,
        includeSettings: wipeIncludeSettings,
      });
      setWipeReport(report);
      setWipeModalOpen(false);
      setWipeConfirmInput("");
      const [inv, pol, audit] = await Promise.all([
        getDataInventory(),
        getRetentionPolicy(),
        runDataAudit("quick"),
      ]);
      setInventory(inv);
      setPolicy(pol);
      setAuditReport(audit);
      setStatusBanner(
        "Full Local Data Wipe verified: selected local records have been removed from the application database."
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Failed to execute Full Local Data Wipe"
      );
    } finally {
      setBusyAction(null);
    }
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: "12px",
    border: "1px solid var(--nr-border-default, #27272a)",
    backgroundColor: "var(--nr-bg-surface, #111318)",
    padding: "1.15rem 1.25rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.9rem",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.15rem",
        width: "100%",
      }}
    >
      {/* 1. Privacy & Provider Boundary Disclosure Banner */}
      <section
        aria-label="Local Storage and Privacy Boundary Disclosure"
        style={{
          ...cardStyle,
          borderColor: "rgba(56, 189, 248, 0.3)",
          backgroundColor: "rgba(56, 189, 248, 0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "0.65rem", alignItems: "center" }}>
            <ShieldCheck
              size={20}
              style={{ color: "var(--nr-accent-blue, #38bdf8)", flexShrink: 0 }}
              aria-hidden="true"
            />
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "0.98rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary, #f4f4f5)",
                }}
              >
                Local-First Data Lifecycle & Privacy Controls
              </h2>
              <p
                style={{
                  margin: "0.2rem 0 0",
                  fontSize: "0.78rem",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                  lineHeight: 1.5,
                }}
              >
                {inventory?.providerBoundaryNote ??
                  "Local cleanup and wipe operations remove data stored by Nano Route on this device only. Requests previously transmitted to external AI providers are governed by those providers' own retention policies."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading || busyAction !== null}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.4rem 0.8rem",
              borderRadius: "8px",
              border: "1px solid var(--nr-border-default, #27272a)",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              color: "var(--nr-text-primary, #f4f4f5)",
              fontSize: "0.78rem",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={13} aria-hidden="true" />
            <span>Refresh Inventory</span>
          </button>
        </div>

        <div
          style={{
            fontSize: "0.73rem",
            color: "var(--nr-text-muted, #71717a)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
            paddingTop: "0.55rem",
          }}
        >
          <strong>Storage semantics:</strong>{" "}
          {inventory?.storageSemanticsNote ??
            "Removed records are logically deleted from the local SQLite application database. SQLite free-page reuse and WAL checkpointing do not constitute cryptographic disk-sector erasure."}
        </div>
      </section>

      {/* Error & Status Alerts */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "10px",
            border: "1px solid rgba(239, 68, 68, 0.4)",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            color: "#fca5a5",
            fontSize: "0.82rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{errorMessage}</span>
          </span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#fca5a5",
              cursor: "pointer",
              fontSize: "0.78rem",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {statusBanner && (
        <div
          role="status"
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "10px",
            border: "1px solid rgba(34, 197, 94, 0.35)",
            backgroundColor: "rgba(34, 197, 94, 0.08)",
            color: "#86efac",
            fontSize: "0.82rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>{statusBanner}</span>
          </span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#86efac",
              cursor: "pointer",
              fontSize: "0.78rem",
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Local Data Inventory & Classification */}
      <section aria-labelledby="data-inventory-heading" style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <HardDrive
              size={17}
              style={{ color: "var(--nr-accent-purple, #a855f7)" }}
              aria-hidden="true"
            />
            <h3
              id="data-inventory-heading"
              style={{
                margin: 0,
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "var(--nr-text-primary, #f4f4f5)",
              }}
            >
              Local Data Inventory & Classification
            </h3>
          </div>
          {inventory && (
            <span
              style={{
                fontSize: "0.74rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              Database: <code>{inventory.databasePath}</code>
            </span>
          )}
        </div>

        {inventory && (
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.79rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--nr-border-default, #27272a)",
                    textAlign: "left",
                    color: "var(--nr-text-secondary, #a1a1aa)",
                  }}
                >
                  <th style={{ padding: "0.5rem 0.6rem" }}>Dataset</th>
                  <th style={{ padding: "0.5rem 0.6rem" }}>Category</th>
                  <th style={{ padding: "0.5rem 0.6rem" }}>Deletion Policy</th>
                  <th style={{ padding: "0.5rem 0.6rem", textAlign: "right" }}>
                    Records
                  </th>
                </tr>
              </thead>
              <tbody>
                {inventory.items.map((item) => {
                  const catBadge = formatCategoryBadge(item.category);
                  const polBadge = formatDeletionPolicyBadge(
                    item.deletionPolicy
                  );
                  return (
                    <tr
                      key={item.storeId}
                      style={{
                        borderBottom:
                          "1px solid var(--nr-border-subtle, #1f222b)",
                      }}
                    >
                      <td style={{ padding: "0.55rem 0.6rem" }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "var(--nr-text-primary, #f4f4f5)",
                          }}
                        >
                          {item.displayName}
                        </div>
                        <div
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--nr-text-muted, #71717a)",
                          }}
                        >
                          {item.description}
                        </div>
                      </td>
                      <td style={{ padding: "0.55rem 0.6rem" }}>
                        <span
                          style={{
                            padding: "0.18rem 0.5rem",
                            borderRadius: "999px",
                            fontSize: "0.7rem",
                            backgroundColor: catBadge.bg,
                            color: catBadge.color,
                          }}
                        >
                          {catBadge.label}
                        </span>
                      </td>
                      <td style={{ padding: "0.55rem 0.6rem" }}>
                        <span
                          style={{
                            padding: "0.18rem 0.5rem",
                            borderRadius: "999px",
                            fontSize: "0.7rem",
                            backgroundColor: polBadge.bg,
                            color: polBadge.color,
                          }}
                        >
                          {polBadge.label}
                        </span>
                      </td>
                      <td
                        style={{
                          padding: "0.55rem 0.6rem",
                          textAlign: "right",
                          fontWeight: 600,
                          color: "var(--nr-text-primary, #f4f4f5)",
                        }}
                      >
                        {item.recordCount.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Safe Credential Metadata Summary */}
        {inventory && inventory.credentials.length > 0 && (
          <div
            style={{
              padding: "0.65rem 0.85rem",
              borderRadius: "8px",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              border: "1px solid var(--nr-border-subtle, #1f222b)",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.6rem",
              fontSize: "0.75rem",
            }}
          >
            <Lock size={14} style={{ color: "#fbbf24" }} aria-hidden="true" />
            <span style={{ color: "var(--nr-text-secondary, #a1a1aa)" }}>
              Configured DPAPI Provider Keys (metadata only, secrets never
              exposed):
            </span>
            {inventory.credentials.map((c) => (
              <span
                key={c.providerId}
                style={{
                  padding: "0.15rem 0.5rem",
                  borderRadius: "6px",
                  backgroundColor: "rgba(251, 191, 36, 0.12)",
                  color: "#fde68a",
                  fontWeight: 500,
                }}
              >
                {c.providerId} ({c.isActive ? "Active" : "Disabled"})
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 3. Database Health, Integrity Audit & Orphan Detection */}
      <section aria-labelledby="integrity-audit-heading" style={cardStyle}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.65rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Database
              size={17}
              style={{ color: "var(--nr-accent-blue, #38bdf8)" }}
              aria-hidden="true"
            />
            <h3
              id="integrity-audit-heading"
              style={{
                margin: 0,
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "var(--nr-text-primary, #f4f4f5)",
              }}
            >
              Database Health, Telemetry Consistency & Orphan Audit
            </h3>
            {auditReport && (
              <span
                style={{
                  padding: "0.2rem 0.6rem",
                  borderRadius: "999px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  backgroundColor: formatHealthStateBadge(
                    auditReport.healthState
                  ).bg,
                  color: formatHealthStateBadge(auditReport.healthState).color,
                }}
              >
                {formatHealthStateBadge(auditReport.healthState).label}
              </span>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => void handleRunAudit("quick")}
              disabled={busyAction !== null}
              style={{
                padding: "0.4rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid var(--nr-border-default, #27272a)",
                backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                color: "var(--nr-text-primary, #f4f4f5)",
                fontSize: "0.76rem",
                cursor: "pointer",
              }}
            >
              Run Quick Check
            </button>
            <button
              type="button"
              onClick={() => void handleRunAudit("full")}
              disabled={busyAction !== null}
              style={{
                padding: "0.4rem 0.8rem",
                borderRadius: "8px",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                backgroundColor: "rgba(56, 189, 248, 0.14)",
                color: "var(--nr-accent-blue, #38bdf8)",
                fontSize: "0.76rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Run Full Integrity & Privacy Audit
            </button>
            <button
              type="button"
              onClick={() => void handleSafeRepair()}
              disabled={busyAction !== null}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.4rem 0.8rem",
                borderRadius: "8px",
                border: "1px solid rgba(168, 85, 247, 0.4)",
                backgroundColor: "rgba(168, 85, 247, 0.14)",
                color: "#d8b4fe",
                fontSize: "0.76rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <Wrench size={13} aria-hidden="true" />
              <span>Rebuild Search Index (Safe Repair)</span>
            </button>
          </div>
        </div>

        {auditReport && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(195px, 1fr))",
              gap: "0.65rem",
            }}
          >
            <div
              style={{
                padding: "0.65rem 0.8rem",
                borderRadius: "8px",
                backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                fontSize: "0.76rem",
              }}
            >
              <div style={{ color: "var(--nr-text-muted, #71717a)" }}>
                SQLite Integrity ({auditReport.mode.toUpperCase()})
              </div>
              <div
                style={{
                  marginTop: "0.2rem",
                  fontWeight: 600,
                  color: auditReport.sqliteIntegrityOk ? "#86efac" : "#fca5a5",
                }}
              >
                {auditReport.sqliteIntegrityOk
                  ? "OK (Verified)"
                  : auditReport.sqliteIntegrityMessage}
              </div>
            </div>

            <div
              style={{
                padding: "0.65rem 0.8rem",
                borderRadius: "8px",
                backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                fontSize: "0.76rem",
              }}
            >
              <div style={{ color: "var(--nr-text-muted, #71717a)" }}>
                FTS5 Search Index Sync
              </div>
              <div
                style={{
                  marginTop: "0.2rem",
                  fontWeight: 600,
                  color: auditReport.orphanSummary.searchIndexInSync
                    ? "#86efac"
                    : "#fde047",
                }}
              >
                {auditReport.orphanSummary.searchIndexInSync
                  ? `In Sync (${auditReport.orphanSummary.actualSearchIndexEntries} entries)`
                  : `Drift: ${auditReport.orphanSummary.searchIndexMismatchCount} entry(ies)`}
              </div>
            </div>

            <div
              style={{
                padding: "0.65rem 0.8rem",
                borderRadius: "8px",
                backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                fontSize: "0.76rem",
              }}
            >
              <div style={{ color: "var(--nr-text-muted, #71717a)" }}>
                Orphaned Messages / FK Check
              </div>
              <div
                style={{
                  marginTop: "0.2rem",
                  fontWeight: 600,
                  color:
                    auditReport.orphanSummary.orphanedMessagesCount === 0 &&
                    auditReport.foreignKeysOk
                      ? "#86efac"
                      : "#fca5a5",
                }}
              >
                {auditReport.orphanSummary.orphanedMessagesCount} orphaned ·{" "}
                {auditReport.foreignKeyViolationsCount} FK violations
              </div>
            </div>

            <div
              style={{
                padding: "0.65rem 0.8rem",
                borderRadius: "8px",
                backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                fontSize: "0.76rem",
              }}
            >
              <div style={{ color: "var(--nr-text-muted, #71717a)" }}>
                Telemetry Anomalies
              </div>
              <div
                style={{
                  marginTop: "0.2rem",
                  fontWeight: 600,
                  color:
                    auditReport.telemetryConsistency
                      .futureTimestampAnomalyCount === 0 &&
                    auditReport.telemetryConsistency.negativeLatencyCount === 0
                      ? "#86efac"
                      : "#fde047",
                }}
              >
                {auditReport.telemetryConsistency.futureTimestampAnomalyCount}{" "}
                future-dated ·{" "}
                {auditReport.telemetryConsistency.negativeLatencyCount +
                  auditReport.telemetryConsistency.negativeTokenCount +
                  auditReport.telemetryConsistency.negativeCostCount}{" "}
                numeric
              </div>
            </div>
          </div>
        )}

        {auditReport && auditReport.findings.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
            {auditReport.findings.map((f) => (
              <div
                key={f.code}
                style={{
                  padding: "0.55rem 0.8rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(250, 204, 21, 0.35)",
                  backgroundColor: "rgba(250, 204, 21, 0.08)",
                  color: "#fef08a",
                  fontSize: "0.76rem",
                }}
              >
                <strong>[{f.code}]</strong> {f.message}
              </div>
            ))}
          </div>
        )}

        {repairResult && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "#d8b4fe",
              padding: "0.5rem 0.75rem",
              borderRadius: "8px",
              backgroundColor: "rgba(168, 85, 247, 0.1)",
            }}
          >
            {repairResult.message}
          </div>
        )}
      </section>

      {/* 4. Retention Policy Configuration */}
      <section aria-labelledby="retention-policy-heading" style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Sliders
            size={17}
            style={{ color: "var(--nr-accent-purple, #a855f7)" }}
            aria-hidden="true"
          />
          <h3
            id="retention-policy-heading"
            style={{
              margin: 0,
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "var(--nr-text-primary, #f4f4f5)",
            }}
          >
            Local Retention Policy (Disabled by Default)
          </h3>
        </div>

        <form
          onSubmit={(e) => void handleSavePolicy(e)}
          style={{ display: "flex", flexDirection: "column", gap: "0.8rem" }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "0.8rem",
            }}
          >
            {/* History Retention */}
            <div
              style={{
                padding: "0.8rem",
                borderRadius: "8px",
                backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                border: "1px solid var(--nr-border-subtle, #1f222b)",
                display: "flex",
                flexDirection: "column",
                gap: "0.55rem",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary, #f4f4f5)",
                }}
              >
                <input
                  type="checkbox"
                  checked={policy.historyRetentionEnabled}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      historyRetentionEnabled: e.target.checked,
                    }))
                  }
                />
                <span>Enable Conversation History Retention</span>
              </label>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.78rem",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                }}
              >
                <span>Retain conversations for (days):</span>
                <input
                  type="number"
                  min={MIN_RETENTION_DAYS}
                  max={MAX_RETENTION_DAYS}
                  value={policy.historyRetentionDays}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      historyRetentionDays: Math.max(
                        MIN_RETENTION_DAYS,
                        Math.min(
                          MAX_RETENTION_DAYS,
                          parseInt(e.target.value || "30", 10) || 30
                        )
                      ),
                    }))
                  }
                  style={{
                    width: "80px",
                    padding: "0.3rem 0.5rem",
                    borderRadius: "6px",
                    border: "1px solid var(--nr-border-default, #27272a)",
                    backgroundColor: "var(--nr-bg-surface, #111318)",
                    color: "var(--nr-text-primary, #f4f4f5)",
                  }}
                />
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.76rem",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                }}
              >
                <input
                  type="checkbox"
                  checked={policy.excludePinnedSessions}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      excludePinnedSessions: e.target.checked,
                    }))
                  }
                />
                <span>Exclude pinned conversations from retention cleanup</span>
              </label>
            </div>

            {/* Telemetry Retention */}
            <div
              style={{
                padding: "0.8rem",
                borderRadius: "8px",
                backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                border: "1px solid var(--nr-border-subtle, #1f222b)",
                display: "flex",
                flexDirection: "column",
                gap: "0.55rem",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary, #f4f4f5)",
                }}
              >
                <input
                  type="checkbox"
                  checked={policy.telemetryRetentionEnabled}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      telemetryRetentionEnabled: e.target.checked,
                    }))
                  }
                />
                <span>Enable Operational Telemetry Retention</span>
              </label>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  fontSize: "0.78rem",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                }}
              >
                <span>Retain telemetry for (days):</span>
                <input
                  type="number"
                  min={MIN_RETENTION_DAYS}
                  max={MAX_RETENTION_DAYS}
                  value={policy.telemetryRetentionDays}
                  onChange={(e) =>
                    setPolicy((p) => ({
                      ...p,
                      telemetryRetentionDays: Math.max(
                        MIN_RETENTION_DAYS,
                        Math.min(
                          MAX_RETENTION_DAYS,
                          parseInt(e.target.value || "30", 10) || 30
                        )
                      ),
                    }))
                  }
                  style={{
                    width: "80px",
                    padding: "0.3rem 0.5rem",
                    borderRadius: "6px",
                    border: "1px solid var(--nr-border-default, #27272a)",
                    backgroundColor: "var(--nr-bg-surface, #111318)",
                    color: "var(--nr-text-primary, #f4f4f5)",
                  }}
                />
              </div>

              <span
                style={{
                  fontSize: "0.73rem",
                  color: "var(--nr-text-muted, #71717a)",
                }}
              >
                Future-dated records and active streaming sessions are
                automatically protected.
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
            <button
              type="submit"
              disabled={busyAction !== null}
              style={{
                padding: "0.45rem 0.95rem",
                borderRadius: "8px",
                border: "1px solid rgba(168, 85, 247, 0.45)",
                backgroundColor: "rgba(168, 85, 247, 0.18)",
                color: "var(--nr-text-primary, #f4f4f5)",
                fontSize: "0.79rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Save Retention Policy
            </button>

            <button
              type="button"
              onClick={() => void handlePreviewCleanup("retention_policy")}
              disabled={busyAction !== null}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.45rem 0.9rem",
                borderRadius: "8px",
                border: "1px solid var(--nr-border-default, #27272a)",
                backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                color: "var(--nr-text-primary, #f4f4f5)",
                fontSize: "0.78rem",
                cursor: "pointer",
              }}
            >
              <Eye size={14} aria-hidden="true" />
              <span>Dry-Run Preview Retention Cleanup</span>
            </button>
          </div>
        </form>
      </section>

      {/* 5. Targeted Cleanup & Dry-Run Preview Confirmation */}
      <section aria-labelledby="targeted-cleanup-heading" style={cardStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Trash2
            size={17}
            style={{ color: "#fbbf24" }}
            aria-hidden="true"
          />
          <h3
            id="targeted-cleanup-heading"
            style={{
              margin: 0,
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "var(--nr-text-primary, #f4f4f5)",
            }}
          >
            Targeted Telemetry & Conversation Cleanup
          </h3>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: "0.77rem",
            color: "var(--nr-text-secondary, #a1a1aa)",
          }}
        >
          Preview exact record counts before executing a targeted cleanup.
          Provider credentials and application settings are strictly preserved.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
          <button
            type="button"
            onClick={() =>
              void handlePreviewCleanup("telemetry_only", {
                olderThanDays: policy.telemetryRetentionDays,
              })
            }
            disabled={busyAction !== null}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "8px",
              border: "1px solid var(--nr-border-default, #27272a)",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              color: "var(--nr-text-primary, #f4f4f5)",
              fontSize: "0.77rem",
              cursor: "pointer",
            }}
          >
            Preview Telemetry Cleanup (&gt;{policy.telemetryRetentionDays}d)
          </button>

          <button
            type="button"
            onClick={() =>
              void handlePreviewCleanup("telemetry_only", { deleteAll: true })
            }
            disabled={busyAction !== null}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "8px",
              border: "1px solid rgba(251, 191, 36, 0.35)",
              backgroundColor: "rgba(251, 191, 36, 0.1)",
              color: "#fde68a",
              fontSize: "0.77rem",
              cursor: "pointer",
            }}
          >
            Preview Clear All Telemetry
          </button>

          <button
            type="button"
            onClick={() =>
              void handlePreviewCleanup("history_only", {
                olderThanDays: policy.historyRetentionDays,
              })
            }
            disabled={busyAction !== null}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "8px",
              border: "1px solid var(--nr-border-default, #27272a)",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              color: "var(--nr-text-primary, #f4f4f5)",
              fontSize: "0.77rem",
              cursor: "pointer",
            }}
          >
            Preview History Cleanup (&gt;{policy.historyRetentionDays}d)
          </button>
        </div>

        {/* Dry-Run Preview Confirmation Box */}
        {cleanupPreview && (
          <div
            role="region"
            aria-label="Cleanup Dry-Run Preview"
            style={{
              padding: "0.9rem 1rem",
              borderRadius: "10px",
              border: "1px solid rgba(251, 191, 36, 0.45)",
              backgroundColor: "rgba(251, 191, 36, 0.08)",
              display: "flex",
              flexDirection: "column",
              gap: "0.65rem",
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: "0.84rem",
                color: "#fde68a",
              }}
            >
              {cleanupPreview.summaryMessage}
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--nr-text-secondary, #a1a1aa)",
              }}
            >
              Search index entries affected:{" "}
              {cleanupPreview.affectedSearchIndexEntriesCount.toLocaleString()}{" "}
              · Credentials preserved: Yes · Settings preserved: Yes
            </div>
            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button
                type="button"
                onClick={() => void handleConfirmCleanup()}
                disabled={busyAction !== null}
                style={{
                  padding: "0.42rem 0.9rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(239, 68, 68, 0.5)",
                  backgroundColor: "rgba(239, 68, 68, 0.2)",
                  color: "#fca5a5",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Confirm & Execute Cleanup
              </button>
              <button
                type="button"
                onClick={() => {
                  setCleanupPreview(null);
                  setPendingCleanupScope(null);
                }}
                style={{
                  padding: "0.42rem 0.85rem",
                  borderRadius: "8px",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  backgroundColor: "transparent",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {cleanupResult && (
          <div
            style={{
              padding: "0.75rem 0.95rem",
              borderRadius: "8px",
              border: "1px solid rgba(34, 197, 94, 0.35)",
              backgroundColor: "rgba(34, 197, 94, 0.08)",
              fontSize: "0.76rem",
              color: "#86efac",
            }}
          >
            <div>
              <strong>Verification ({cleanupResult.verificationStatus}):</strong>{" "}
              Deleted {cleanupResult.deletedSessionsCount} session(s),{" "}
              {cleanupResult.deletedMessagesCount} message(s),{" "}
              {cleanupResult.deletedTelemetryRecordsCount} telemetry record(s).
              Rebuilt {cleanupResult.rebuiltSearchIndexEntriesCount} FTS5
              entries.
            </div>
            <div style={{ marginTop: "0.25rem", opacity: 0.85 }}>
              {cleanupResult.storageNote}
            </div>
          </div>
        )}
      </section>

      {/* 6. Danger Zone: Full Local Data Wipe */}
      <section
        aria-labelledby="full-data-wipe-heading"
        style={{
          ...cardStyle,
          borderColor: "rgba(239, 68, 68, 0.4)",
          backgroundColor: "rgba(239, 68, 68, 0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.65rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ShieldAlert
              size={18}
              style={{ color: "#f87171" }}
              aria-hidden="true"
            />
            <div>
              <h3
                id="full-data-wipe-heading"
                style={{
                  margin: 0,
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "#fca5a5",
                }}
              >
                Full Local Data Wipe
              </h3>
              <p
                style={{
                  margin: "0.2rem 0 0",
                  fontSize: "0.76rem",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                }}
              >
                Permanently removes all local conversation history, FTS5 search
                indexes, operational telemetry, application settings, and
                DPAPI-protected provider credentials from the Nano Route
                database.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleOpenWipeModal()}
            disabled={busyAction !== null}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border: "1px solid rgba(239, 68, 68, 0.55)",
              backgroundColor: "rgba(239, 68, 68, 0.18)",
              color: "#fca5a5",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Preview Full Local Data Wipe...
          </button>
        </div>

        {/* High-Friction Confirmation Modal */}
        {wipeModalOpen && wipePreview && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-wipe-dialog-title"
            style={{
              padding: "1rem 1.15rem",
              borderRadius: "10px",
              border: "1px solid rgba(239, 68, 68, 0.6)",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <h4
              id="confirm-wipe-dialog-title"
              style={{
                margin: 0,
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "#fca5a5",
              }}
            >
              Confirm Full Local Data Wipe
            </h4>

            <div
              style={{
                fontSize: "0.77rem",
                color: "var(--nr-text-secondary, #a1a1aa)",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "0.45rem",
              }}
            >
              <div>
                Sessions to remove:{" "}
                <strong>{wipePreview.sessionsToDelete.toLocaleString()}</strong>
              </div>
              <div>
                Messages to remove:{" "}
                <strong>{wipePreview.messagesToDelete.toLocaleString()}</strong>
              </div>
              <div>
                Telemetry records:{" "}
                <strong>
                  {wipePreview.telemetryRecordsToDelete.toLocaleString()}
                </strong>
              </div>
              <div>
                Search index entries:{" "}
                <strong>
                  {wipePreview.searchIndexEntriesToDelete.toLocaleString()}
                </strong>
              </div>
              <div>
                DPAPI credentials:{" "}
                <strong>
                  {wipePreview.providerCredentialsToDelete.toLocaleString()}
                </strong>
              </div>
              <div>
                App settings:{" "}
                <strong>
                  {wipePreview.appSettingsToReset.toLocaleString()}
                </strong>
              </div>
            </div>

            {!wipePreview.canProceed && wipePreview.blockReason && (
              <div
                role="alert"
                style={{
                  padding: "0.55rem 0.75rem",
                  borderRadius: "6px",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  color: "#fca5a5",
                  fontSize: "0.76rem",
                }}
              >
                {wipePreview.blockReason}
              </div>
            )}

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "1rem",
                fontSize: "0.76rem",
                color: "var(--nr-text-secondary, #a1a1aa)",
              }}
            >
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <input
                  type="checkbox"
                  checked={wipeIncludeCredentials}
                  onChange={(e) => setWipeIncludeCredentials(e.target.checked)}
                />
                <span>Delete DPAPI Provider Credentials</span>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <input
                  type="checkbox"
                  checked={wipeIncludeSettings}
                  onChange={(e) => setWipeIncludeSettings(e.target.checked)}
                />
                <span>Reset Application Settings to Defaults</span>
              </label>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                fontSize: "0.78rem",
              }}
            >
              <label
                htmlFor="wipe-confirm-token-input"
                style={{ color: "var(--nr-text-primary, #f4f4f5)" }}
              >
                Type <code>{EXECUTE_FULL_WIPE_TOKEN_TEXT}</code> to confirm
                permanent removal from the local database:
              </label>
              <input
                id="wipe-confirm-token-input"
                type="text"
                value={wipeConfirmInput}
                onChange={(e) => setWipeConfirmInput(e.target.value)}
                placeholder={EXECUTE_FULL_WIPE_TOKEN_TEXT}
                style={{
                  maxWidth: "240px",
                  padding: "0.4rem 0.65rem",
                  borderRadius: "6px",
                  border: "1px solid rgba(239, 68, 68, 0.5)",
                  backgroundColor: "var(--nr-bg-surface, #111318)",
                  color: "var(--nr-text-primary, #f4f4f5)",
                  fontSize: "0.82rem",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: "0.6rem" }}>
              <button
                type="button"
                onClick={() => void handleExecuteFullWipe()}
                disabled={
                  !wipePreview.canProceed ||
                  wipeConfirmInput !== FULL_WIPE_CONFIRMATION_TOKEN ||
                  busyAction !== null
                }
                style={{
                  padding: "0.45rem 0.95rem",
                  borderRadius: "8px",
                  border: "1px solid rgba(239, 68, 68, 0.65)",
                  backgroundColor:
                    wipeConfirmInput === FULL_WIPE_CONFIRMATION_TOKEN &&
                    wipePreview.canProceed
                      ? "#dc2626"
                      : "rgba(239, 68, 68, 0.12)",
                  color: "#ffffff",
                  fontSize: "0.79rem",
                  fontWeight: 600,
                  cursor:
                    wipeConfirmInput === FULL_WIPE_CONFIRMATION_TOKEN &&
                    wipePreview.canProceed
                      ? "pointer"
                      : "not-allowed",
                }}
              >
                Execute Full Local Data Wipe
              </button>
              <button
                type="button"
                onClick={() => {
                  setWipeModalOpen(false);
                  setWipeConfirmInput("");
                }}
                style={{
                  padding: "0.45rem 0.9rem",
                  borderRadius: "8px",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  backgroundColor: "transparent",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                  fontSize: "0.79rem",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {wipeReport && (
          <div
            style={{
              padding: "0.75rem 0.95rem",
              borderRadius: "8px",
              border: "1px solid rgba(34, 197, 94, 0.35)",
              backgroundColor: "rgba(34, 197, 94, 0.08)",
              fontSize: "0.76rem",
              color: "#86efac",
            }}
          >
            <strong>Post-Wipe Verification ({wipeReport.verificationStatus}):</strong>{" "}
            Removed {wipeReport.deletedSessionsCount} session(s),{" "}
            {wipeReport.deletedMessagesCount} message(s),{" "}
            {wipeReport.deletedTelemetryRecordsCount} telemetry record(s),{" "}
            {wipeReport.deletedCredentialsCount} credential(s), and reset{" "}
            {wipeReport.resetSettingsCount} setting(s). Remaining user sessions:{" "}
            {wipeReport.remainingSessionsCount}.
          </div>
        )}
      </section>
    </div>
  );
};

