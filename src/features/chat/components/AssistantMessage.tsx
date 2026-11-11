/**
//! Nano Route — Assistant Chat Message Bubble
//! File: src/features/chat/components/AssistantMessage.tsx
//!
//! Renders assistant responses with Markdown formatting, syntax-highlighted code blocks,
//! routed model metadata badges, and accessible copy actions.
*/

import React, { useState, useCallback } from "react";
import { Bot, Check, Copy, HelpCircle, AlertTriangle, AlertCircle } from "lucide-react";
import type { ChatMessage } from "../types";
import type { RoutingExplanationDto } from "../../../services/ipc/types";
import { getRoutingExplanation } from "../../../services/ipc/chat";
import { SafeMarkdown } from "./SafeMarkdown";
import { ModelBadge } from "./ModelBadge";
import { RoutingExplanationPanel } from "./RoutingExplanationPanel";

export interface AssistantMessageProps {
  message: ChatMessage;
  className?: string;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  className = "",
}) => {
  const [copied, setCopied] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [explanation, setExplanation] = useState<RoutingExplanationDto | null>(null);
  const [isLoadingExplanation, setIsLoadingExplanation] = useState(false);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const formatCategoryLabel = (cat?: string): string => {
    if (!cat) return "Generation incomplete";
    return cat
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const formatUserAction = (action?: string): string | null => {
    switch (action) {
      case "configure_provider":
        return "Configure provider credentials in Settings";
      case "update_credential":
        return "Verify or update your API key in Settings";
      case "check_provider_access":
        return "Check your provider account permissions and organization access";
      case "reduce_input":
        return "Reduce the length of your prompt or attached context";
      case "change_unsupported_option":
        return "Modify unsupported parameters or switch model options";
      case "wait_and_retry_later":
        return "Wait a moment for rate limits or transient issues to clear before retrying";
      case "check_network":
        return "Check your internet connection and DNS settings";
      case "contact_provider":
        return "Check provider status page for service outages";
      default:
        return null;
    }
  };

  const handleCopy = useCallback(async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(message.content);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore copy error
    }
  }, [message.content]);

  const handleToggleExplanation = useCallback(async () => {
    if (showExplanation) {
      setShowExplanation(false);
      return;
    }
    setShowExplanation(true);
    if (!explanation && !isLoadingExplanation) {
      setIsLoadingExplanation(true);
      setExplanationError(null);
      try {
        const result = await getRoutingExplanation(message.id, message.sessionId);
        setExplanation(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setExplanationError(msg);
      } finally {
        setIsLoadingExplanation(false);
      }
    }
  }, [showExplanation, explanation, isLoadingExplanation, message.id, message.sessionId]);

  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={`nr-assistant-message-container ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        margin: "1rem 0",
        width: "100%",
      }}
    >
      {/* Header Info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          marginBottom: "0.35rem",
          fontSize: "0.75rem",
          color: "var(--nr-text-muted, #71717a)",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            backgroundColor: "var(--nr-accent-blue, #2563eb)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
          }}
        >
          <Bot style={{ width: "12px", height: "12px" }} />
        </div>
        <span style={{ fontWeight: 600, color: "var(--nr-text-secondary, #a1a1aa)" }}>
          Assistant
        </span>
        <ModelBadge metadata={message.metadata} />

        {/* Step 37: Discreet automatic failover indicator badge */}
        {message.metadata?.failoverUsed && (
          <span
            className="nr-failover-badge"
            data-testid="failover-badge"
            title={
              message.metadata.failoverReason
                ? `Automatic failover: ${message.metadata.failoverReason}`
                : "Automatic failover candidate used"
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "0.7rem",
              color: "var(--nr-accent-amber, #f59e0b)",
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
              borderRadius: "var(--nr-radius-sm, 4px)",
              padding: "0.1rem 0.4rem",
              fontWeight: 500,
            }}
            role="status"
            aria-label="Failover fallback used"
          >
            <span>
              {message.metadata.failoverFromProvider
                ? `Fallback from ${message.metadata.failoverFromProvider}`
                : "Fallback used"}
            </span>
          </span>
        )}

        {/* Step 38: Discreet automatic retry indicator badge */}
        {!message.metadata?.failoverUsed && Boolean(message.metadata?.retryCount && message.metadata.retryCount > 0) && (
          <span
            className="nr-retry-badge"
            data-testid="retry-badge"
            title={`Completed after ${message.metadata?.retryCount} automatic retry attempt(s)`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "0.7rem",
              color: "var(--nr-accent-cyan, #06b6d4)",
              backgroundColor: "rgba(6, 182, 212, 0.12)",
              border: "1px solid rgba(6, 182, 212, 0.3)",
              borderRadius: "var(--nr-radius-sm, 4px)",
              padding: "0.1rem 0.4rem",
              fontWeight: 500,
            }}
            role="status"
            aria-label="Completed after retry"
          >
            <span>Retried ({message.metadata?.retryCount})</span>
          </span>
        )}

        {/* Step 34: Why this route? toggle button */}
        {!message.isStreaming && (
          <button
            type="button"
            className="nr-why-route-button"
            data-testid="why-route-button"
            onClick={handleToggleExplanation}
            aria-expanded={showExplanation}
            aria-controls={`routing-explanation-${message.id}`}
            title="View why this model was chosen and see score breakdown"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              background: showExplanation
                ? "rgba(6, 182, 212, 0.15)"
                : "rgba(255, 255, 255, 0.04)",
              border: `1px solid ${
                showExplanation
                  ? "rgba(6, 182, 212, 0.35)"
                  : "var(--nr-border-subtle, #27272a)"
              }`,
              borderRadius: "var(--nr-radius-sm, 4px)",
              padding: "0.15rem 0.45rem",
              fontSize: "0.7rem",
              color: showExplanation
                ? "var(--nr-accent-cyan, #22d3ee)"
                : "var(--nr-text-muted, #a1a1aa)",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <HelpCircle style={{ width: "11px", height: "11px" }} />
            <span>{showExplanation ? "Hide route details" : "Why this route?"}</span>
          </button>
        )}

        <span>{formattedTime}</span>
        {message.isStreaming && (
          <span
            className="nr-streaming-badge"
            data-testid="streaming-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.7rem",
              color: "var(--nr-accent-cyan, #06b6d4)",
              fontWeight: 500,
            }}
            role="status"
            aria-label="Generating response"
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "var(--nr-accent-cyan, #06b6d4)",
              }}
            />
            Streaming...
          </span>
        )}
        {message.isFailed && (
          <span
            className="nr-failed-badge"
            data-testid="failed-badge"
            data-error-category={message.error?.category}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "0.7rem",
              color: "var(--nr-status-error, #ef4444)",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              borderRadius: "var(--nr-radius-sm, 4px)",
              padding: "0.1rem 0.4rem",
              fontWeight: 500,
            }}
            role="alert"
          >
            <AlertTriangle style={{ width: "11px", height: "11px" }} />
            {message.error ? formatCategoryLabel(message.error.category) : "Generation incomplete"}
          </span>
        )}
        {message.isCancelled && (
          <span
            className="nr-cancelled-badge"
            data-testid="cancelled-badge"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "0.7rem",
              color: "var(--nr-status-warning, #f59e0b)",
              backgroundColor: "rgba(245, 158, 11, 0.12)",
              border: "1px solid rgba(245, 158, 11, 0.25)",
              borderRadius: "var(--nr-radius-sm, 4px)",
              padding: "0.1rem 0.4rem",
              fontWeight: 500,
            }}
            role="status"
            aria-label="Generation stopped"
          >
            Generation stopped
          </span>
        )}
      </div>

      {/* Message Body Card */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "92%",
          padding: "1rem 1.25rem",
          borderRadius: "0 var(--nr-radius-lg, 8px) var(--nr-radius-lg, 8px) var(--nr-radius-lg, 8px)",
          backgroundColor: "var(--nr-bg-surface, #111318)",
          border: "1px solid var(--nr-border-default, #27272a)",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
        }}
      >
        {message.content ? (
          <SafeMarkdown content={message.content} />
        ) : message.isCancelled ? (
          <p
            style={{
              fontStyle: "italic",
              color: "var(--nr-text-muted, #71717a)",
              margin: 0,
              fontSize: "0.875rem",
            }}
          >
            Generation was stopped before a response was received.
          </p>
        ) : null}

        {/* Step 36: Normalized Error Presentation Card */}
        {message.error && (
          <div
            data-testid="error-envelope-card"
            style={{
              marginTop: message.content ? "0.75rem" : "0",
              padding: "0.75rem",
              borderRadius: "var(--nr-radius-md, 6px)",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.25)",
              fontSize: "0.8125rem",
            }}
            role="alert"
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
              <AlertCircle
                style={{
                  width: "16px",
                  height: "16px",
                  color: "var(--nr-status-error, #ef4444)",
                  marginTop: "2px",
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  data-testid="error-user-message"
                  style={{
                    fontWeight: 600,
                    color: "var(--nr-text-primary, #ffffff)",
                    marginBottom: "0.25rem",
                  }}
                >
                  {message.error.userMessage}
                </div>
                {message.error.userAction && message.error.userAction !== "none" && (
                  <div
                    data-testid="error-user-action"
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--nr-accent-blue, #38bdf8)",
                      marginTop: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.25rem",
                    }}
                  >
                    <span>💡 Action:</span>
                    <span>{formatUserAction(message.error.userAction)}</span>
                  </div>
                )}
                {message.error.retryabilityHint &&
                  message.error.retryabilityHint !== "not_applicable" && (
                    <div
                      data-testid="error-retryability-hint"
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--nr-text-muted, #9ca3af)",
                        marginTop: "0.2rem",
                      }}
                    >
                      Retryability: {message.error.retryabilityHint.replace(/_/g, " ")}
                    </div>
                  )}
                <div style={{ marginTop: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => setShowDiagnostics((prev) => !prev)}
                    data-testid="toggle-diagnostics-btn"
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "var(--nr-text-muted, #71717a)",
                      fontSize: "0.7rem",
                      cursor: "pointer",
                      padding: 0,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      textDecoration: "underline",
                    }}
                  >
                    {showDiagnostics ? "Hide diagnostics" : "Show diagnostics"}
                  </button>
                  {showDiagnostics && (
                    <div
                      data-testid="error-diagnostics-panel"
                      style={{
                        marginTop: "0.35rem",
                        padding: "0.5rem",
                        backgroundColor: "rgba(0, 0, 0, 0.3)",
                        borderRadius: "var(--nr-radius-sm, 4px)",
                        fontSize: "0.7rem",
                        fontFamily: "monospace",
                        color: "var(--nr-text-secondary, #d1d5db)",
                        wordBreak: "break-all",
                      }}
                    >
                      <div>
                        <strong>Code:</strong> {message.error.errorCode}
                      </div>
                      <div>
                        <strong>Category:</strong> {message.error.category}
                      </div>
                      <div>
                        <strong>Severity:</strong> {message.error.severity}
                      </div>
                      <div>
                        <strong>Provenance:</strong> {message.error.provenance}
                      </div>
                      {message.error.httpStatus && (
                        <div>
                          <strong>HTTP Status:</strong> {message.error.httpStatus}
                        </div>
                      )}
                      {message.error.providerId && (
                        <div>
                          <strong>Provider:</strong> {message.error.providerId}
                        </div>
                      )}
                      {message.error.modelId && (
                        <div>
                          <strong>Model:</strong> {message.error.modelId}
                        </div>
                      )}
                      {message.error.executionId && (
                        <div>
                          <strong>Execution ID:</strong> {message.error.executionId}
                        </div>
                      )}
                      <div style={{ marginTop: "0.25rem" }}>
                        <strong>Diagnostic Detail:</strong> {message.error.technicalMessage}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {message.isStreaming && (
          <span
            className="nr-streaming-cursor"
            data-testid="streaming-cursor"
            style={{
              display: "inline-block",
              width: "6px",
              height: "14px",
              marginLeft: "3px",
              verticalAlign: "-2px",
              backgroundColor: "var(--nr-accent-blue, #38bdf8)",
              borderRadius: "1px",
            }}
            aria-hidden="true"
          />
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "0.5rem",
            paddingTop: "0.35rem",
            borderTop: "1px solid var(--nr-border-subtle, #1f222b)",
          }}
        >
          <button
            type="button"
            onClick={handleCopy}
            aria-label={copied ? "Response copied to clipboard" : "Copy response"}
            title="Copy response"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0.2rem 0.5rem",
              fontSize: "0.75rem",
              color: copied ? "var(--nr-status-success, #10b981)" : "var(--nr-text-muted, #71717a)",
              borderRadius: "var(--nr-radius-sm, 4px)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = copied
                ? "var(--nr-status-success, #10b981)"
                : "var(--nr-text-primary, #ffffff)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = copied
                ? "var(--nr-status-success, #10b981)"
                : "var(--nr-text-muted, #71717a)";
            }}
          >
            {copied ? (
              <>
                <Check style={{ width: "12px", height: "12px" }} />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy style={{ width: "12px", height: "12px" }} />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Step 34: Expandable Route Explanation Panel */}
        {showExplanation && (
          <div
            id={`routing-explanation-${message.id}`}
            style={{ width: "100%", marginTop: "0.5rem" }}
          >
            <RoutingExplanationPanel
              explanation={explanation}
              isLoading={isLoadingExplanation}
              error={explanationError}
            />
          </div>
        )}
      </div>
    </div>
  );
};

