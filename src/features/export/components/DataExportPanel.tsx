/**
 * Nano Route — User Data Export & Privacy Portability Panel
 * File: src/features/export/components/DataExportPanel.tsx
 *
 * Implements Step 70 user-facing data export interface: selective category selection,
 * privacy disclosures, format selection, progress tracking, and validation summaries.
 */

import React, { useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Layers,
  MessageSquare,
  Palette,
  RefreshCw,
  Server,
  ShieldCheck,
} from "lucide-react";
import {
  type ExportCategory,
  type ExportFormat,
  type ExportExecutionResult,
  type ExportOperationStatus,
} from "../types.ts";
import { EXPORT_CATEGORIES_CATALOG } from "../catalog.ts";
import { executeDataExport } from "../engine.ts";
import { useNotifications } from "../../notifications";

export const DataExportPanel: React.FC = () => {
  const { publish } = useNotifications();

  const [selectedCategories, setSelectedCategories] = useState<Set<ExportCategory>>(
    new Set(["chat_history", "user_preferences", "workspace_profiles", "telemetry_and_analytics"])
  );
  const [format, setFormat] = useState<ExportFormat>("json");
  const [status, setStatus] = useState<ExportOperationStatus>("IDLE");
  const [result, setResult] = useState<ExportExecutionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const toggleCategory = (cat: ExportCategory) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedCategories(new Set(Object.keys(EXPORT_CATEGORIES_CATALOG) as ExportCategory[]));
  };

  const selectNone = () => {
    setSelectedCategories(new Set());
  };

  const isExecuting =
    status === "PREPARING" || status === "COLLECTING" || status === "SERIALIZING" || status === "VALIDATING";

  const handleStartExport = async () => {
    if (selectedCategories.size === 0 || isExecuting) return;

    setStatus("COLLECTING");
    setErrorMessage(null);
    setCopied(false);

    try {
      const res = await executeDataExport({
        categories: Array.from(selectedCategories),
        format,
      });

      setResult(res);
      if (res.success) {
        setStatus("COMPLETED");
        publish({
          title: "Data Export Generated",
          message: `Successfully serialized ${res.manifest.totalEstimatedRecords} records. ${res.verificationReport}`,
          severity: "success",
          source: "System",
        });
      } else {
        setStatus("FAILED");
        setErrorMessage(res.error || "Export validation failed.");
      }
    } catch (err: unknown) {
      setStatus("FAILED");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDownloadJson = () => {
    if (!result?.serializedJson) return;
    const blob = new Blob([result.serializedJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `nano-route-export-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadCsv = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyClipboard = async () => {
    if (!result?.serializedJson) return;
    try {
      await navigator.clipboard.writeText(result.serializedJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Non-fatal
    }
  };

  const getCategoryIcon = (cat: ExportCategory) => {
    switch (cat) {
      case "chat_history":
        return <MessageSquare style={{ width: "16px", height: "16px", color: "#38bdf8" }} />;
      case "user_preferences":
        return <Palette style={{ width: "16px", height: "16px", color: "#a855f7" }} />;
      case "workspace_profiles":
        return <Layers style={{ width: "16px", height: "16px", color: "#818cf8" }} />;
      case "telemetry_and_analytics":
        return <HardDrive style={{ width: "16px", height: "16px", color: "#34d399" }} />;
      case "provider_registry_metadata":
        return <Server style={{ width: "16px", height: "16px", color: "#fbbf24" }} />;
    }
  };

  const getSensitivityBadge = (label: string) => {
    const isPrivate = label.includes("Private");
    return (
      <span
        style={{
          display: "inline-block",
          padding: "0.15rem 0.5rem",
          borderRadius: "0.25rem",
          fontSize: "0.75rem",
          fontWeight: 600,
          backgroundColor: isPrivate ? "rgba(239, 68, 68, 0.15)" : "rgba(59, 130, 246, 0.15)",
          color: isPrivate ? "#f87171" : "#60a5fa",
        }}
      >
        {label}
      </span>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>
      {/* Overview Banner */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "1rem",
          padding: "1.25rem",
          borderRadius: "0.5rem",
          backgroundColor: "var(--nr-surface-card, #1e1e24)",
          border: "1px solid var(--nr-border-subtle, #2d2d35)",
        }}
      >
        <Download style={{ width: "24px", height: "24px", color: "#38bdf8", flexShrink: 0, marginTop: "0.2rem" }} />
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "var(--nr-text-primary, #f3f4f6)" }}>
            User Data Export & Privacy Portability
          </h3>
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.875rem", color: "var(--nr-text-secondary, #9ca3af)", lineHeight: 1.5 }}>
            Export your locally stored conversation history, UI preferences, custom profiles, and telemetry into standard, readable JSON or CSV files.
            Export is purely an observational read: source data is <strong>never deleted or modified</strong>.
          </p>
        </div>
      </div>

      {/* Security Exclusions Notice */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.875rem 1rem",
          borderRadius: "0.5rem",
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          border: "1px solid rgba(16, 185, 129, 0.25)",
          color: "#34d399",
          fontSize: "0.8125rem",
        }}
      >
        <ShieldCheck style={{ width: "18px", height: "18px", flexShrink: 0 }} />
        <div>
          <strong>Strict Security Guarantee: </strong>
          Windows DPAPI credentials, plaintext API keys, and bearer tokens are strictly barred and never exported.
        </div>
      </div>

      {/* Category Selection Section */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "1.25rem",
          borderRadius: "0.5rem",
          backgroundColor: "var(--nr-surface-card, #1e1e24)",
          border: "1px solid var(--nr-border-subtle, #2d2d35)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>1. Select Categories to Export</h4>
            <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary, #9ca3af)", marginTop: "0.2rem" }}>
              Choose which data domains to include in the portable package.
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={selectAll}
              disabled={isExecuting}
              style={{
                padding: "0.25rem 0.625rem",
                borderRadius: "0.25rem",
                background: "transparent",
                border: "1px solid var(--nr-border-subtle, #2d2d35)",
                color: "var(--nr-text-secondary, #9ca3af)",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              Select All
            </button>
            <button
              type="button"
              onClick={selectNone}
              disabled={isExecuting}
              style={{
                padding: "0.25rem 0.625rem",
                borderRadius: "0.25rem",
                background: "transparent",
                border: "1px solid var(--nr-border-subtle, #2d2d35)",
                color: "var(--nr-text-secondary, #9ca3af)",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              Deselect All
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {(Object.keys(EXPORT_CATEGORIES_CATALOG) as ExportCategory[]).map((catKey) => {
            const desc = EXPORT_CATEGORIES_CATALOG[catKey];
            const isChecked = selectedCategories.has(catKey);

            return (
              <label
                key={catKey}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  padding: "0.875rem",
                  borderRadius: "0.375rem",
                  backgroundColor: isChecked ? "rgba(56, 189, 248, 0.05)" : "rgba(0, 0, 0, 0.15)",
                  border: `1px solid ${isChecked ? "rgba(56, 189, 248, 0.3)" : "var(--nr-border-subtle, #2d2d35)"}`,
                  cursor: isExecuting ? "not-allowed" : "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleCategory(catKey)}
                  disabled={isExecuting}
                  style={{ marginTop: "0.25rem", width: "16px", height: "16px" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    {getCategoryIcon(catKey)}
                    <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--nr-text-primary, #f3f4f6)" }}>
                      {desc.displayName}
                    </span>
                    {getSensitivityBadge(desc.sensitivityLabel)}
                  </div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary, #9ca3af)", marginTop: "0.25rem" }}>
                    {desc.shortDescription}
                  </div>
                  {desc.warningNotice && isChecked && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        marginTop: "0.5rem",
                        padding: "0.35rem 0.5rem",
                        borderRadius: "0.25rem",
                        backgroundColor: "rgba(245, 158, 11, 0.1)",
                        color: "#fbbf24",
                        fontSize: "0.75rem",
                      }}
                    >
                      <AlertTriangle style={{ width: "12px", height: "12px", flexShrink: 0 }} />
                      <span>{desc.warningNotice}</span>
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Format Selection Section */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          padding: "1.25rem",
          borderRadius: "0.5rem",
          backgroundColor: "var(--nr-surface-card, #1e1e24)",
          border: "1px solid var(--nr-border-subtle, #2d2d35)",
        }}
      >
        <h4 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>2. Choose Export Format</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.75rem" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor: format === "json" ? "rgba(168, 85, 247, 0.1)" : "rgba(0, 0, 0, 0.15)",
              border: `1px solid ${format === "json" ? "var(--nr-accent-purple, #a855f7)" : "var(--nr-border-subtle, #2d2d35)"}`,
              cursor: isExecuting ? "not-allowed" : "pointer",
            }}
          >
            <input
              type="radio"
              name="export-format"
              value="json"
              checked={format === "json"}
              onChange={() => setFormat("json")}
              disabled={isExecuting}
            />
            <FileText style={{ width: "16px", height: "16px", color: "#a855f7" }} />
            <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>JSON Package</span>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor: format === "csv" ? "rgba(168, 85, 247, 0.1)" : "rgba(0, 0, 0, 0.15)",
              border: `1px solid ${format === "csv" ? "var(--nr-accent-purple, #a855f7)" : "var(--nr-border-subtle, #2d2d35)"}`,
              cursor: isExecuting ? "not-allowed" : "pointer",
            }}
          >
            <input
              type="radio"
              name="export-format"
              value="csv"
              checked={format === "csv"}
              onChange={() => setFormat("csv")}
              disabled={isExecuting}
            />
            <FileSpreadsheet style={{ width: "16px", height: "16px", color: "#34d399" }} />
            <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>CSV Tables</span>
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor: format === "json_and_csv" ? "rgba(168, 85, 247, 0.1)" : "rgba(0, 0, 0, 0.15)",
              border: `1px solid ${format === "json_and_csv" ? "var(--nr-accent-purple, #a855f7)" : "var(--nr-border-subtle, #2d2d35)"}`,
              cursor: isExecuting ? "not-allowed" : "pointer",
            }}
          >
            <input
              type="radio"
              name="export-format"
              value="json_and_csv"
              checked={format === "json_and_csv"}
              onChange={() => setFormat("json_and_csv")}
              disabled={isExecuting}
            />
            <HardDrive style={{ width: "16px", height: "16px", color: "#38bdf8" }} />
            <span style={{ fontSize: "0.875rem", fontWeight: 500 }}>Combined (JSON + CSV)</span>
          </label>
        </div>
      </div>

      {/* Export Action & Status */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <button
          type="button"
          onClick={handleStartExport}
          disabled={selectedCategories.size === 0 || isExecuting}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.625rem 1.25rem",
            borderRadius: "0.375rem",
            backgroundColor: selectedCategories.size > 0 ? "#38bdf8" : "rgba(255, 255, 255, 0.1)",
            border: "none",
            color: selectedCategories.size > 0 ? "#0f172a" : "#64748b",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: selectedCategories.size > 0 && !isExecuting ? "pointer" : "not-allowed",
          }}
        >
          {isExecuting ? (
            <RefreshCw style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
          ) : (
            <Download style={{ width: "16px", height: "16px" }} />
          )}
          <span>{isExecuting ? `${status}...` : `Generate Export (${selectedCategories.size} Categories)`}</span>
        </button>

        {errorMessage && (
          <div style={{ color: "#f87171", fontSize: "0.8125rem", display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <AlertTriangle style={{ width: "14px", height: "14px" }} />
            <span>{errorMessage}</span>
          </div>
        )}
      </div>

      {/* Export Success & Download Area */}
      {result && result.success && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
            padding: "1.25rem",
            borderRadius: "0.5rem",
            backgroundColor: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CheckCircle style={{ width: "20px", height: "20px", color: "#34d399" }} />
              <h4 style={{ margin: 0, fontSize: "1rem", fontWeight: 600, color: "#34d399" }}>
                Export Package Ready ({result.manifest.totalEstimatedRecords} Records)
              </h4>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary, #9ca3af)" }}>
              Checksum: <code style={{ color: "#38bdf8" }}>{result.manifest.checksum}</code> | Size: {(result.totalSizeBytes / 1024).toFixed(1)} KB
            </div>
          </div>

          {/* Record Breakdown */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
              gap: "0.5rem",
              backgroundColor: "rgba(0, 0, 0, 0.2)",
              padding: "0.75rem",
              borderRadius: "0.375rem",
              fontSize: "0.8125rem",
            }}
          >
            <div><strong>Sessions:</strong> {result.manifest.recordCounts.sessionsCount}</div>
            <div><strong>Messages:</strong> {result.manifest.recordCounts.messagesCount}</div>
            <div><strong>Telemetry:</strong> {result.manifest.recordCounts.telemetryCount}</div>
            <div><strong>Preferences:</strong> {result.manifest.recordCounts.preferencesCount}</div>
            <div><strong>Profiles:</strong> {result.manifest.recordCounts.profilesCount}</div>
            <div><strong>Providers:</strong> {result.manifest.recordCounts.providersCount}</div>
          </div>

          {/* Download & Copy Buttons */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {result.serializedJson && (
              <button
                type="button"
                onClick={handleDownloadJson}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "#34d399",
                  border: "none",
                  color: "#064e3b",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Download style={{ width: "14px", height: "14px" }} />
                <span>Save JSON Package</span>
              </button>
            )}

            {result.csvFiles &&
              Object.entries(result.csvFiles).map(([fname, content]) => (
                <button
                  key={fname}
                  type="button"
                  onClick={() => handleDownloadCsv(fname, content)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.5rem 1rem",
                    borderRadius: "0.375rem",
                    backgroundColor: "transparent",
                    border: "1px solid rgba(52, 211, 153, 0.4)",
                    color: "#34d399",
                    fontSize: "0.8125rem",
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  <FileSpreadsheet style={{ width: "14px", height: "14px" }} />
                  <span>Download {fname}</span>
                </button>
              ))}

            {result.serializedJson && (
              <button
                type="button"
                onClick={handleCopyClipboard}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.5rem 1rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "transparent",
                  border: "1px solid var(--nr-border-subtle, #2d2d35)",
                  color: "var(--nr-text-secondary, #9ca3af)",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <Copy style={{ width: "14px", height: "14px" }} />
                <span>{copied ? "Copied!" : "Copy JSON to Clipboard"}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

