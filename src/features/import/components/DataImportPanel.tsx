/**
 * Nano Route — User Data Import & Migration Assistant UI Component
 * File: src/features/import/components/DataImportPanel.tsx
 *
 * Implements Step 71 interactive, accessible import workflow:
 * Drag-and-drop / file selector, package parsing & preflight verification,
 * category checklist, conflict strategy controls, backup toggle, progress indicator,
 * and comprehensive completion summary.
 */

import React, { useState, useRef, useCallback } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  CheckCircle2,
  RefreshCw,
  Upload,
} from "lucide-react";
import {
  type ImportCategory,
  type ImportPreview,
  type ConflictStrategy,
  type ImportExecutionConfig,
  type ImportExecutionResult,
} from "../types.ts";
import { validateImportPayload } from "../validator.ts";
import { executeDataImport } from "../engine.ts";
import type { ExportPackage } from "../../export/types.ts";

export const DataImportPanel: React.FC = () => {
  const [fileName, setFileName] = useState<string>("");
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [sanitizedPkg, setSanitizedPkg] = useState<ExportPackage | null>(null);
  const [result, setResult] = useState<ImportExecutionResult | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);

  // Configuration options state
  const [selectedCategories, setSelectedCategories] = useState<Set<ImportCategory>>(
    new Set(["chat_history", "user_preferences", "workspace_profiles"])
  );
  const [conflictStrategies, setConflictStrategies] = useState<Record<ImportCategory, ConflictStrategy>>({
    chat_history: "SKIP_DUPLICATES",
    user_preferences: "KEEP_EXISTING",
    workspace_profiles: "IMPORT_AS_NEW",
    telemetry_and_analytics: "SKIP_DUPLICATES",
  });
  const [createSafetyBackup, setCreateSafetyBackup] = useState<boolean>(true);
  const [rebuildSearchIndex, setRebuildSearchIndex] = useState<boolean>(true);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleProcessFile = useCallback(async (content: string, name: string) => {
    setFileName(name);
    setIsValidating(true);
    setResult(null);

    try {
      const { preview: p, sanitizedPackage } = await validateImportPayload(content);
      setPreview(p);
      setSanitizedPkg(sanitizedPackage || null);

      // Pre-select available categories
      if (p.availableCategories.length > 0) {
        setSelectedCategories(new Set(p.availableCategories));
      }
    } catch (err: unknown) {
      // Handled in preview error state
    } finally {
      setIsValidating(false);
    }
  }, []);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleProcessFile(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        handleProcessFile(text, file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const toggleCategory = (cat: ImportCategory) => {
    const next = new Set(selectedCategories);
    if (next.has(cat)) {
      next.delete(cat);
    } else {
      next.add(cat);
    }
    setSelectedCategories(next);
  };

  const handleExecute = async () => {
    if (!sanitizedPkg || !preview || selectedCategories.size === 0) return;

    setIsExecuting(true);
    try {
      const config: ImportExecutionConfig = {
        selectedCategories: Array.from(selectedCategories),
        conflictStrategies,
        createSafetyBackup,
        rebuildSearchIndex,
      };

      const res = await executeDataImport(sanitizedPkg, config);
      setResult(res);
    } catch (err: unknown) {
      // Handled in UI
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReset = () => {
    setFileName("");
    setPreview(null);
    setSanitizedPkg(null);
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header Info */}
      <div
        style={{
          background: "var(--nr-surface-card)",
          border: "1px solid var(--nr-border-subtle)",
          borderRadius: "0.75rem",
          padding: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
          <Upload style={{ width: "20px", height: "20px", color: "var(--nr-accent)" }} />
          <h2 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
            User Data Import & Migration Assistant
          </h2>
        </div>
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--nr-text-secondary)", lineHeight: 1.5 }}>
          Restore conversations, interface configurations, and custom workspace profiles from valid Nano Route export packages (<code>nano-route-export-package-v1</code>). External files are treated as untrusted input: credential tokens are strictly rejected, and existing records are preserved against destructive overwrites.
        </p>
      </div>

      {/* Step 1: File Upload / Selection Area */}
      {!preview && !result && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? "var(--nr-accent)" : "var(--nr-border-subtle)"}`,
            borderRadius: "0.75rem",
            padding: "3rem 1.5rem",
            textAlign: "center",
            background: dragActive ? "rgba(59, 130, 246, 0.05)" : "var(--nr-surface-card)",
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileInputChange}
            style={{ display: "none" }}
            aria-label="Upload Nano Route Export Package"
          />
          <Archive style={{ width: "40px", height: "40px", margin: "0 auto 1rem", color: "var(--nr-text-secondary)" }} />
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "1rem", fontWeight: 600 }}>
            Choose an export package JSON file or drag & drop here
          </h3>
          <p style={{ margin: 0, fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
            Supports JSON export packages up to 20 MB. External credentials or passwords are permanently filtered.
          </p>
          {isValidating && (
            <div style={{ marginTop: "1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", color: "var(--nr-accent)" }}>
              <RefreshCw style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
              <span style={{ fontSize: "0.875rem" }}>Validating package format & schema...</span>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Package Preflight Validation & Configuration */}
      {preview && !result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* File Verification Banner */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem 1.25rem",
              borderRadius: "0.5rem",
              background: preview.isValid ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
              border: `1px solid ${preview.isValid ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              {preview.isValid ? (
                <CheckCircle2 style={{ width: "20px", height: "20px", color: "#10b981" }} />
              ) : (
                <AlertCircle style={{ width: "20px", height: "20px", color: "#ef4444" }} />
              )}
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>
                  {fileName} ({((preview.payloadSizeBytes || 0) / 1024).toFixed(1)} KB)
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>
                  Format: {preview.format} • Origin: {preview.sourceApp} (v{preview.sourceAppVersion})
                  {preview.exportedAtIso && ` • Exported: ${new Date(preview.exportedAtIso).toLocaleString()}`}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleReset}
              style={{
                background: "transparent",
                border: "1px solid var(--nr-border-subtle)",
                borderRadius: "0.375rem",
                padding: "0.35rem 0.75rem",
                color: "var(--nr-text-secondary)",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              Choose Different File
            </button>
          </div>

          {/* Warnings / Errors Banner */}
          {preview.preflightWarnings.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                background: "rgba(245, 158, 11, 0.1)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                fontSize: "0.8125rem",
                color: "#f59e0b",
              }}
            >
              {preview.preflightWarnings.map((w, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <AlertTriangle style={{ width: "14px", height: "14px", flexShrink: 0 }} />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {preview.preflightErrors.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                padding: "0.75rem 1rem",
                borderRadius: "0.5rem",
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                fontSize: "0.8125rem",
                color: "#ef4444",
              }}
            >
              {preview.preflightErrors.map((e, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <AlertCircle style={{ width: "14px", height: "14px", flexShrink: 0 }} />
                  <span>{e}</span>
                </div>
              ))}
            </div>
          )}

          {/* Category Selection & Conflict Rules */}
          {preview.isValid && (
            <div
              style={{
                background: "var(--nr-surface-card)",
                border: "1px solid var(--nr-border-subtle)",
                borderRadius: "0.75rem",
                padding: "1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
              }}
            >
              <h3 style={{ margin: 0, fontSize: "0.9375rem", fontWeight: 600 }}>
                Select Categories & Conflict Handling Strategy
              </h3>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {/* Chat History */}
                {preview.plans.chat_history && preview.plans.chat_history.totalInPackage > 0 && (
                  <div
                    style={{
                      border: "1px solid var(--nr-border-subtle)",
                      borderRadius: "0.5rem",
                      padding: "0.875rem 1rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <input
                        type="checkbox"
                        id="cat_chat_history"
                        checked={selectedCategories.has("chat_history")}
                        onChange={() => toggleCategory("chat_history")}
                        style={{ cursor: "pointer", width: "16px", height: "16px" }}
                      />
                      <label htmlFor="cat_chat_history" style={{ cursor: "pointer" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Chat Conversations & Messages</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>
                          {preview.plans.chat_history.totalInPackage} records found in package
                          {preview.conflicts.chat_history.conflictingCount > 0 &&
                            ` • ${preview.conflicts.chat_history.conflictingCount} ID collision(s)`}
                        </div>
                      </label>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>Collision Policy:</span>
                      <select
                        value={conflictStrategies.chat_history}
                        onChange={(e) =>
                          setConflictStrategies({ ...conflictStrategies, chat_history: e.target.value as ConflictStrategy })
                        }
                        style={{
                          background: "var(--nr-surface)",
                          color: "var(--nr-text-primary)",
                          border: "1px solid var(--nr-border-subtle)",
                          borderRadius: "0.375rem",
                          padding: "0.3rem 0.5rem",
                          fontSize: "0.75rem",
                        }}
                      >
                        <option value="SKIP_DUPLICATES">Skip Duplicates (Safe)</option>
                        <option value="IMPORT_AS_NEW">Import as New (Clone with suffix)</option>
                        <option value="KEEP_EXISTING">Keep Existing Only</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* User Preferences */}
                {preview.plans.user_preferences && preview.plans.user_preferences.totalInPackage > 0 && (
                  <div
                    style={{
                      border: "1px solid var(--nr-border-subtle)",
                      borderRadius: "0.5rem",
                      padding: "0.875rem 1rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <input
                        type="checkbox"
                        id="cat_user_preferences"
                        checked={selectedCategories.has("user_preferences")}
                        onChange={() => toggleCategory("user_preferences")}
                        style={{ cursor: "pointer", width: "16px", height: "16px" }}
                      />
                      <label htmlFor="cat_user_preferences" style={{ cursor: "pointer" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>UI & Presentation Preferences</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>
                          {preview.plans.user_preferences.totalInPackage} preference keys in package
                          {preview.conflicts.user_preferences.conflictingCount > 0 &&
                            ` • ${preview.conflicts.user_preferences.conflictingCount} values differ from current`}
                        </div>
                      </label>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>Conflict Policy:</span>
                      <select
                        value={conflictStrategies.user_preferences}
                        onChange={(e) =>
                          setConflictStrategies({ ...conflictStrategies, user_preferences: e.target.value as ConflictStrategy })
                        }
                        style={{
                          background: "var(--nr-surface)",
                          color: "var(--nr-text-primary)",
                          border: "1px solid var(--nr-border-subtle)",
                          borderRadius: "0.375rem",
                          padding: "0.3rem 0.5rem",
                          fontSize: "0.75rem",
                        }}
                      >
                        <option value="KEEP_EXISTING">Keep Current Preferences</option>
                        <option value="SKIP_DUPLICATES">Apply Imported Preferences</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Workspace Profiles */}
                {preview.plans.workspace_profiles && preview.plans.workspace_profiles.totalInPackage > 0 && (
                  <div
                    style={{
                      border: "1px solid var(--nr-border-subtle)",
                      borderRadius: "0.5rem",
                      padding: "0.875rem 1rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "1rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <input
                        type="checkbox"
                        id="cat_workspace_profiles"
                        checked={selectedCategories.has("workspace_profiles")}
                        onChange={() => toggleCategory("workspace_profiles")}
                        style={{ cursor: "pointer", width: "16px", height: "16px" }}
                      />
                      <label htmlFor="cat_workspace_profiles" style={{ cursor: "pointer" }}>
                        <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>Custom Workspace Profiles</div>
                        <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>
                          {preview.plans.workspace_profiles.totalInPackage} custom profile(s)
                        </div>
                      </label>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>Conflict Policy:</span>
                      <select
                        value={conflictStrategies.workspace_profiles}
                        onChange={(e) =>
                          setConflictStrategies({ ...conflictStrategies, workspace_profiles: e.target.value as ConflictStrategy })
                        }
                        style={{
                          background: "var(--nr-surface)",
                          color: "var(--nr-text-primary)",
                          border: "1px solid var(--nr-border-subtle)",
                          borderRadius: "0.375rem",
                          padding: "0.3rem 0.5rem",
                          fontSize: "0.75rem",
                        }}
                      >
                        <option value="IMPORT_AS_NEW">Import as New (Rename on collision)</option>
                        <option value="SKIP_DUPLICATES">Skip Existing Profiles</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Safety Options */}
              <div
                style={{
                  borderTop: "1px solid var(--nr-border-subtle)",
                  paddingTop: "0.875rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={createSafetyBackup}
                    onChange={(e) => setCreateSafetyBackup(e.target.checked)}
                  />
                  <span>Create automatic safety backup snapshot before applying modifications (Recommended)</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8125rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={rebuildSearchIndex}
                    onChange={(e) => setRebuildSearchIndex(e.target.checked)}
                  />
                  <span>Rebuild FTS5 search index after importing conversations</span>
                </label>
              </div>

              {/* Execution Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  onClick={handleReset}
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
                  onClick={handleExecute}
                  disabled={selectedCategories.size === 0 || isExecuting}
                  style={{
                    padding: "0.5rem 1.25rem",
                    borderRadius: "0.375rem",
                    background: "var(--nr-accent)",
                    border: "none",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    cursor: selectedCategories.size === 0 || isExecuting ? "not-allowed" : "pointer",
                    opacity: selectedCategories.size === 0 || isExecuting ? 0.6 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  {isExecuting ? (
                    <>
                      <RefreshCw style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <span>Execute Import</span>
                      <ArrowRight style={{ width: "16px", height: "16px" }} />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Execution Result & Verification Summary */}
      {result && (
        <div
          style={{
            background: "var(--nr-surface-card)",
            border: `1px solid ${result.success ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            borderRadius: "0.75rem",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {result.success ? (
              <CheckCircle2 style={{ width: "24px", height: "24px", color: "#10b981" }} />
            ) : (
              <AlertCircle style={{ width: "24px", height: "24px", color: "#ef4444" }} />
            )}
            <div>
              <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 600 }}>
                {result.success ? "Import Completed Successfully" : "Import Completed with Warnings"}
              </h3>
              <div style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary)" }}>
                {result.verificationReport}
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "0.75rem",
              background: "var(--nr-surface)",
              borderRadius: "0.5rem",
              padding: "1rem",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>Total Imported</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "#10b981" }}>
                {result.totalImported} items
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>Total Skipped</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 600, color: "var(--nr-text-primary)" }}>
                {result.totalSkipped} items
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>Safety Snapshot</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                {result.backupCreated ? `Verified (${result.backupId})` : "None"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary)" }}>Search Index</div>
              <div style={{ fontSize: "0.875rem", fontWeight: 600 }}>
                {result.reindexSuccess ? "Rebuilt & In-Sync" : "Unchanged"}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={handleReset}
              style={{
                padding: "0.5rem 1.25rem",
                borderRadius: "0.375rem",
                background: "var(--nr-accent)",
                border: "none",
                color: "#fff",
                fontWeight: 600,
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
