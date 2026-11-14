/**
 * Nano Route — Reset & Recovery Confirmation Modal
 * File: src/features/reset/components/ResetModal.tsx
 *
 * Implements Step 69 accessible, multi-step reset preview, consequence disclosure,
 * optional pre-reset backup selection, typed token verification, and live progress state.
 */

import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import {
  type ResetOperationType,
  type ResetScopeDefinition,
  type ResetExecutionResult,
  type ResetOperationStatus,
} from "../types.ts";
import { getResetScopeDefinition } from "../catalog.ts";
import { executeResetOperation } from "../engine.ts";

interface ResetModalProps {
  operation: ResetOperationType | null;
  providerId?: string;
  onClose: () => void;
  onSuccess: (result: ResetExecutionResult) => void;
}

export const ResetModal: React.FC<ResetModalProps> = ({
  operation,
  providerId,
  onClose,
  onSuccess,
}) => {
  const [definition, setDefinition] = useState<ResetScopeDefinition | null>(null);
  const [typedInput, setTypedInput] = useState<string>("");
  const [createBackup, setCreateBackup] = useState<boolean>(true);
  const [userDataScope, setUserDataScope] = useState<
    "history_only" | "telemetry_only" | "search_index_rebuild"
  >("history_only");

  const [status, setStatus] = useState<ResetOperationStatus>("NOT_STARTED");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [executionResult, setExecutionResult] = useState<ResetExecutionResult | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const confirmInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (operation) {
      const def = getResetScopeDefinition(operation);
      setDefinition(def);
      setTypedInput("");
      setCreateBackup(def.offersPreResetBackup);
      setStatus("NOT_STARTED");
      setErrorMessage(null);
      setExecutionResult(null);
    } else {
      setDefinition(null);
    }
  }, [operation]);

  // Focus management
  useEffect(() => {
    if (definition?.requiresTypedToken) {
      confirmInputRef.current?.focus();
    }
  }, [definition]);

  // Keyboard escape handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && status !== "EXECUTING" && status !== "PREPARING") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, status]);

  if (!operation || !definition) {
    return null;
  }

  const isTokenValid = !definition.requiresTypedToken || typedInput.trim() === definition.expectedToken;
  const isExecuting = status === "VALIDATING" || status === "PREPARING" || status === "EXECUTING" || status === "VERIFYING";

  const handleExecute = async () => {
    if (!isTokenValid || isExecuting) return;

    setStatus("PREPARING");
    setErrorMessage(null);

    try {
      const result = await executeResetOperation({
        operation,
        confirmed: true,
        typedToken: typedInput.trim(),
        providerId,
        userDataScope: operation === "CLEAR_SELECTED_USER_DATA" ? userDataScope : undefined,
        createBackupFirst: createBackup,
      });

      setExecutionResult(result);
      if (result.status === "COMPLETED") {
        setStatus("COMPLETED");
        onSuccess(result);
      } else {
        setStatus(result.status);
        setErrorMessage(result.error || result.verificationMessage);
      }
    } catch (err: unknown) {
      setStatus("FAILED");
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const getClassificationColor = () => {
    switch (definition.classification) {
      case "IRREVERSIBLE_OR_PRACTICALLY_IRREVERSIBLE":
        return "#ef4444";
      case "SECURITY_SENSITIVE":
      case "DATA_DELETION":
        return "#f59e0b";
      case "CONFIGURATION_RESET":
        return "#3b82f6";
      default:
        return "#10b981";
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-modal-title"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "1.5rem",
      }}
    >
      <div
        ref={modalRef}
        style={{
          width: "100%",
          maxWidth: "640px",
          maxHeight: "90vh",
          overflowY: "auto",
          backgroundColor: "var(--nr-surface-card, #1e1e24)",
          border: `1px solid ${getClassificationColor()}`,
          borderRadius: "0.75rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
          padding: "1.5rem",
          color: "var(--nr-text-primary, #f3f4f6)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <ShieldAlert style={{ width: "24px", height: "24px", color: getClassificationColor(), flexShrink: 0 }} />
            <div>
              <h2 id="reset-modal-title" style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
                {definition.displayName}
              </h2>
              <span
                style={{
                  display: "inline-block",
                  marginTop: "0.25rem",
                  padding: "0.15rem 0.5rem",
                  borderRadius: "0.25rem",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  backgroundColor: `${getClassificationColor()}22`,
                  color: getClassificationColor(),
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {definition.classification.replace(/_/g, " ")}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            aria-label="Close dialog"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--nr-text-secondary, #9ca3af)",
              cursor: isExecuting ? "not-allowed" : "pointer",
              padding: "0.25rem",
            }}
          >
            <X style={{ width: "20px", height: "20px" }} />
          </button>
        </div>

        {/* Short Description */}
        <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--nr-text-secondary, #9ca3af)", lineHeight: 1.5 }}>
          {definition.shortDescription}
        </p>

        {/* Scope Matrix Preview */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            backgroundColor: "rgba(0, 0, 0, 0.25)",
            padding: "1rem",
            borderRadius: "0.5rem",
            border: "1px solid var(--nr-border-subtle, #2d2d35)",
            fontSize: "0.8125rem",
          }}
        >
          {/* Will Change */}
          {definition.willChange.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, color: "var(--nr-text-primary, #f3f4f6)", marginBottom: "0.25rem" }}>
                Will change:
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "var(--nr-text-secondary, #9ca3af)" }}>
                {definition.willChange.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Will Be Deleted */}
          {definition.willBeDeleted.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, color: "#f87171", marginBottom: "0.25rem" }}>
                Will be deleted permanently:
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#fca5a5" }}>
                {definition.willBeDeleted.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Will Remain Safe */}
          {definition.willRemain.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, color: "#34d399", marginBottom: "0.25rem" }}>
                Will remain intact:
              </div>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#a7f3d0" }}>
                {definition.willRemain.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recovery Option */}
          <div style={{ marginTop: "0.25rem", borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: "0.5rem" }}>
            <span style={{ fontWeight: 600, color: "var(--nr-text-primary, #f3f4f6)" }}>Recovery Guidance: </span>
            <span style={{ color: "var(--nr-text-secondary, #9ca3af)" }}>{definition.recoveryOption}</span>
          </div>
        </div>

        {/* Targeted scope selector for CLEAR_SELECTED_USER_DATA */}
        {operation === "CLEAR_SELECTED_USER_DATA" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <label style={{ fontSize: "0.8125rem", fontWeight: 600 }}>Select data category to clear:</label>
            <select
              value={userDataScope}
              onChange={(e) => setUserDataScope(e.target.value as any)}
              disabled={isExecuting}
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                backgroundColor: "var(--nr-surface-base, #121216)",
                border: "1px solid var(--nr-border-subtle, #2d2d35)",
                color: "#fff",
                fontSize: "0.875rem",
              }}
            >
              <option value="history_only">Chat Conversation History & Messages</option>
              <option value="telemetry_only">Telemetry & Operational Metrics</option>
              <option value="search_index_rebuild">Rebuild FTS5 Search Index Only</option>
            </select>
          </div>
        )}

        {/* Pre-Reset Backup Checkbox */}
        {definition.offersPreResetBackup && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
              fontSize: "0.875rem",
              cursor: isExecuting ? "not-allowed" : "pointer",
              padding: "0.5rem",
              backgroundColor: "rgba(59, 130, 246, 0.08)",
              borderRadius: "0.375rem",
              border: "1px solid rgba(59, 130, 246, 0.2)",
            }}
          >
            <input
              type="checkbox"
              checked={createBackup}
              onChange={(e) => setCreateBackup(e.target.checked)}
              disabled={isExecuting}
              style={{ width: "16px", height: "16px" }}
            />
            <span>Create verified SQLite safety backup archive before resetting (Recommended)</span>
          </label>
        )}

        {/* Typed Confirmation Token Input */}
        {definition.requiresTypedToken && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
            <label htmlFor="confirm-token-input" style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
              To confirm, type <span style={{ color: "#f87171", fontFamily: "monospace" }}>"{definition.expectedToken}"</span> below:
            </label>
            <input
              id="confirm-token-input"
              ref={confirmInputRef}
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              disabled={isExecuting}
              placeholder={definition.expectedToken ?? ""}
              style={{
                padding: "0.625rem 0.75rem",
                borderRadius: "0.375rem",
                backgroundColor: "var(--nr-surface-base, #121216)",
                border: `1px solid ${isTokenValid && typedInput ? "#10b981" : "var(--nr-border-subtle, #2d2d35)"}`,
                color: "#fff",
                fontSize: "0.875rem",
                fontFamily: "monospace",
              }}
            />
          </div>
        )}

        {/* Execution Error Banner */}
        {errorMessage && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem",
              borderRadius: "0.375rem",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              color: "#f87171",
              fontSize: "0.8125rem",
            }}
          >
            <AlertTriangle style={{ width: "16px", height: "16px", flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Execution Success Banner */}
        {status === "COMPLETED" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem",
              borderRadius: "0.375rem",
              backgroundColor: "rgba(16, 185, 129, 0.15)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              color: "#34d399",
              fontSize: "0.8125rem",
            }}
          >
            <CheckCircle style={{ width: "16px", height: "16px", flexShrink: 0 }} />
            <span>{executionResult?.verificationMessage || "Reset completed successfully."}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "0.5rem" }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              backgroundColor: "transparent",
              border: "1px solid var(--nr-border-subtle, #2d2d35)",
              color: "var(--nr-text-secondary, #9ca3af)",
              fontSize: "0.875rem",
              cursor: isExecuting ? "not-allowed" : "pointer",
            }}
          >
            {status === "COMPLETED" ? "Close" : "Cancel"}
          </button>

          {status !== "COMPLETED" && (
            <button
              type="button"
              onClick={handleExecute}
              disabled={!isTokenValid || isExecuting}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1.25rem",
                borderRadius: "0.375rem",
                backgroundColor: isTokenValid ? getClassificationColor() : "rgba(255, 255, 255, 0.1)",
                border: "none",
                color: "#ffffff",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: !isTokenValid || isExecuting ? "not-allowed" : "pointer",
                opacity: !isTokenValid ? 0.6 : 1,
              }}
            >
              {isExecuting && <RefreshCw style={{ width: "14px", height: "14px", animation: "spin 1s linear infinite" }} />}
              <span>
                {isExecuting
                  ? `${status}...`
                  : definition.classification === "IRREVERSIBLE_OR_PRACTICALLY_IRREVERSIBLE"
                  ? "Erase All & Factory Reset"
                  : `Confirm ${definition.displayName}`}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

