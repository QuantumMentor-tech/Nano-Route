/**
//! Nano Route — Routing Explanation & Score Breakdown Panel
//! File: src/features/chat/components/RoutingExplanationPanel.tsx
//!
//! Renders rich, read-only explainability insights for routed assistant messages:
//! - Triad display: SLM Intent Confidence vs Routing Fit vs Selection Margin
//! - Detected task requirements and capabilities
//! - Normalized candidate score breakdown across analytical dimensions
//! - Top eligible alternatives and disqualified candidate reasons
//! - Accessible progress bars with explicit text equivalents
*/

import React from "react";
import {
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  History,
  Info,
  Layers,
  Scale,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import type { RoutingExplanationDto, ScoreDimensionExplanationDto } from "../../../services/ipc/types";

export interface RoutingExplanationPanelProps {
  explanation: RoutingExplanationDto | null;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

export const RoutingExplanationPanel: React.FC<RoutingExplanationPanelProps> = ({
  explanation,
  isLoading = false,
  error = null,
  className = "",
}) => {
  const [showDimensions, setShowDimensions] = React.useState(true);
  const [showAlternatives, setShowAlternatives] = React.useState(false);

  if (isLoading) {
    return (
      <div
        className={`nr-routing-explanation-loading ${className}`}
        style={{
          marginTop: "0.75rem",
          padding: "0.85rem 1rem",
          borderRadius: "var(--nr-radius-md, 6px)",
          backgroundColor: "var(--nr-bg-canvas, #0a0c10)",
          border: "1px solid var(--nr-border-subtle, #1e222d)",
          fontSize: "0.8rem",
          color: "var(--nr-text-muted, #71717a)",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
        role="status"
        aria-live="polite"
      >
        <span
          style={{
            width: "12px",
            height: "12px",
            border: "2px solid var(--nr-accent-cyan, #06b6d4)",
            borderTopColor: "transparent",
            borderRadius: "50%",
            display: "inline-block",
            animation: "spin 1s linear infinite",
          }}
        />
        <span>Resolving route explainability analysis...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`nr-routing-explanation-error ${className}`}
        style={{
          marginTop: "0.75rem",
          padding: "0.75rem 1rem",
          borderRadius: "var(--nr-radius-md, 6px)",
          backgroundColor: "rgba(239, 68, 68, 0.08)",
          border: "1px solid rgba(239, 68, 68, 0.25)",
          color: "var(--nr-status-error, #ef4444)",
          fontSize: "0.8rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
        }}
        role="alert"
      >
        <ShieldAlert style={{ width: "16px", height: "16px", flexShrink: 0 }} />
        <span>Failed to load routing explanation: {error}</span>
      </div>
    );
  }

  if (!explanation) {
    return null;
  }

  const {
    isHistorical,
    summary,
    decisionReason,
    selectedRoute,
    taskSummary,
    scoreBreakdown,
    confidenceSummary,
    selectionMargin,
    alternatives,
    policyFactors,
    selectionMode,
  } = explanation;

  // Confidence Triad metrics
  const slmConfPercent =
    confidenceSummary.slmConfidence !== null && confidenceSummary.slmConfidence !== undefined
      ? Math.round(confidenceSummary.slmConfidence * 100)
      : null;

  const routingFitPercent =
    confidenceSummary.routingFit !== null && confidenceSummary.routingFit !== undefined
      ? Math.round(confidenceSummary.routingFit * 100)
      : null;

  const marginPercent =
    selectionMargin?.margin !== null && selectionMargin?.margin !== undefined
      ? Math.round(selectionMargin.margin * 100)
      : null;

  return (
    <div
      className={`nr-routing-explanation-panel ${className}`}
      data-testid="routing-explanation-panel"
      style={{
        marginTop: "0.75rem",
        padding: "1rem",
        borderRadius: "var(--nr-radius-md, 6px)",
        backgroundColor: "var(--nr-bg-canvas, #090b10)",
        border: "1px solid var(--nr-border-default, #232733)",
        boxShadow: "inset 0 1px 3px rgba(0, 0, 0, 0.4)",
        fontSize: "0.825rem",
        color: "var(--nr-text-secondary, #a1a1aa)",
        width: "100%",
      }}
    >
      {/* Historical Disclaimer Banner */}
      {isHistorical && (
        <div
          data-testid="historical-explanation-banner"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem 0.75rem",
            marginBottom: "0.85rem",
            backgroundColor: "rgba(113, 113, 122, 0.12)",
            border: "1px solid rgba(113, 113, 122, 0.25)",
            borderRadius: "var(--nr-radius-sm, 4px)",
            fontSize: "0.75rem",
            color: "var(--nr-text-muted, #94a3b8)",
          }}
        >
          <History style={{ width: "14px", height: "14px", flexShrink: 0 }} />
          <span>
            Historical route metadata: Full candidate score breakdown is not recorded in SQLite to preserve disk space. Stored routing decision and SLM confidence displayed below.
          </span>
        </div>
      )}

      {/* Primary Decision Summary */}
      <div style={{ marginBottom: "0.85rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.35rem",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Sparkles style={{ width: "14px", height: "14px", color: "var(--nr-accent-cyan, #06b6d4)" }} />
            <span style={{ fontWeight: 600, color: "var(--nr-text-primary, #ffffff)" }}>
              {selectedRoute.modelName || selectedRoute.modelId} ({selectedRoute.providerName || selectedRoute.providerId})
            </span>
            {selectedRoute.isLocal && (
              <span
                style={{
                  fontSize: "0.68rem",
                  padding: "0.1rem 0.35rem",
                  borderRadius: "3px",
                  backgroundColor: "rgba(16, 185, 129, 0.15)",
                  color: "var(--nr-status-success, #10b981)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                }}
              >
                Local SLM
              </span>
            )}
          </div>
          <span
            style={{
              fontSize: "0.72rem",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              padding: "0.15rem 0.45rem",
              borderRadius: "3px",
              backgroundColor:
                selectionMode === "manual_override"
                  ? "rgba(139, 92, 246, 0.15)"
                  : "rgba(6, 182, 212, 0.15)",
              color:
                selectionMode === "manual_override"
                  ? "var(--nr-accent-purple, #a78bfa)"
                  : "var(--nr-accent-cyan, #22d3ee)",
              border: `1px solid ${
                selectionMode === "manual_override"
                  ? "rgba(139, 92, 246, 0.3)"
                  : "rgba(6, 182, 212, 0.3)"
              }`,
            }}
          >
            {selectionMode.replace("_", " ")}
          </span>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "0.8rem",
            lineHeight: 1.45,
            color: "var(--nr-text-secondary, #cbd5e1)",
          }}
          data-testid="explanation-summary"
        >
          {summary || decisionReason}
        </p>
      </div>

      {/* Confidence Triad Cards */}
      <div
        className="nr-confidence-triad"
        data-testid="confidence-triad"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
          gap: "0.6rem",
          marginBottom: "0.85rem",
        }}
      >
        {/* Metric 1: SLM Intent Confidence */}
        <div
          data-testid="slm-confidence-card"
          style={{
            padding: "0.6rem 0.75rem",
            borderRadius: "var(--nr-radius-sm, 4px)",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--nr-border-subtle, #1e222d)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.72rem",
              color: "var(--nr-text-muted, #71717a)",
              marginBottom: "0.2rem",
            }}
            title="Local SLM classifier certainty in intent analysis (not answer correctness)"
          >
            <Brain style={{ width: "13px", height: "13px", color: "var(--nr-accent-blue, #38bdf8)" }} />
            <span>SLM Intent Certainty</span>
          </div>
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              color:
                slmConfPercent !== null
                  ? slmConfPercent >= 80
                    ? "var(--nr-status-success, #10b981)"
                    : slmConfPercent >= 50
                    ? "var(--nr-accent-cyan, #06b6d4)"
                    : "var(--nr-status-warning, #f59e0b)"
                  : "var(--nr-text-muted, #71717a)",
            }}
          >
            {slmConfPercent !== null ? `${slmConfPercent}%` : "N/A"}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--nr-text-muted, #64748b)" }}>
            {confidenceSummary.slmConfidenceLevel} confidence
          </div>
        </div>

        {/* Metric 2: Candidate Suitability Fit */}
        <div
          data-testid="routing-fit-card"
          style={{
            padding: "0.6rem 0.75rem",
            borderRadius: "var(--nr-radius-sm, 4px)",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--nr-border-subtle, #1e222d)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.72rem",
              color: "var(--nr-text-muted, #71717a)",
              marginBottom: "0.2rem",
            }}
            title="Candidate suitability score synthesized from 11 analytical dimensions"
          >
            <Scale style={{ width: "13px", height: "13px", color: "var(--nr-accent-cyan, #06b6d4)" }} />
            <span>Routing Fit Score</span>
          </div>
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              color:
                routingFitPercent !== null
                  ? "var(--nr-accent-cyan, #22d3ee)"
                  : "var(--nr-text-muted, #71717a)",
            }}
          >
            {routingFitPercent !== null ? `${routingFitPercent}%` : "Manual"}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--nr-text-muted, #64748b)" }}>
            {routingFitPercent !== null ? "Normalized multi-factor fit" : "User pinned override"}
          </div>
        </div>

        {/* Metric 3: Selection Margin */}
        <div
          data-testid="selection-margin-card"
          style={{
            padding: "0.6rem 0.75rem",
            borderRadius: "var(--nr-radius-sm, 4px)",
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: "1px solid var(--nr-border-subtle, #1e222d)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.72rem",
              color: "var(--nr-text-muted, #71717a)",
              marginBottom: "0.2rem",
            }}
            title="Score difference between the selected model and the highest runner-up alternative"
          >
            <Zap style={{ width: "13px", height: "13px", color: "var(--nr-accent-yellow, #eab308)" }} />
            <span>Selection Margin</span>
          </div>
          <div
            style={{
              fontSize: "1.1rem",
              fontWeight: 700,
              color:
                marginPercent !== null
                  ? "var(--nr-status-success, #10b981)"
                  : "var(--nr-text-muted, #71717a)",
            }}
          >
            {marginPercent !== null ? `+${marginPercent}%` : "N/A"}
          </div>
          <div style={{ fontSize: "0.68rem", color: "var(--nr-text-muted, #64748b)" }}>
            {selectionMargin?.runnerUpModel
              ? `vs ${selectionMargin.runnerUpModel}`
              : "Clear margin"}
          </div>
        </div>
      </div>

      {/* Task Analysis Summary Section (when available) */}
      {taskSummary && (
        <div
          data-testid="task-analysis-summary"
          style={{
            marginBottom: "0.85rem",
            padding: "0.65rem 0.8rem",
            backgroundColor: "rgba(255, 255, 255, 0.015)",
            border: "1px solid var(--nr-border-subtle, #1e222d)",
            borderRadius: "var(--nr-radius-sm, 4px)",
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--nr-text-primary, #e2e8f0)",
              marginBottom: "0.45rem",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <Brain style={{ width: "12px", height: "12px", color: "var(--nr-accent-blue, #38bdf8)" }} />
            <span>On-Device Task Analysis</span>
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
              fontSize: "0.75rem",
              marginBottom: "0.4rem",
            }}
          >
            <span style={{ color: "var(--nr-text-muted, #94a3b8)" }}>
              Intent: <strong style={{ color: "var(--nr-text-primary, #ffffff)" }}>{taskSummary.intentLabel}</strong>
            </span>
            <span style={{ color: "var(--nr-text-muted, #94a3b8)" }}>•</span>
            <span style={{ color: "var(--nr-text-muted, #94a3b8)" }}>
              Complexity: <strong style={{ color: "var(--nr-text-primary, #ffffff)" }}>{taskSummary.complexityLabel}</strong>
            </span>
            {taskSummary.domains.length > 0 && (
              <>
                <span style={{ color: "var(--nr-text-muted, #94a3b8)" }}>•</span>
                <span style={{ color: "var(--nr-text-muted, #94a3b8)" }}>
                  Domains: <span style={{ color: "var(--nr-text-secondary, #cbd5e1)" }}>{taskSummary.domains.join(", ")}</span>
                </span>
              </>
            )}
          </div>

          {/* Required Capabilities Matched */}
          {taskSummary.requiredCapabilities && taskSummary.requiredCapabilities.length > 0 && (
            <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
              {taskSummary.requiredCapabilities.map((req, idx) => (
                <span
                  key={idx}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    fontSize: "0.68rem",
                    padding: "0.1rem 0.35rem",
                    borderRadius: "3px",
                    backgroundColor: req.isMatchedBySelectedModel
                      ? "rgba(16, 185, 129, 0.1)"
                      : "rgba(239, 68, 68, 0.1)",
                    color: req.isMatchedBySelectedModel
                      ? "var(--nr-status-success, #34d399)"
                      : "var(--nr-status-error, #f87171)",
                    border: `1px solid ${
                      req.isMatchedBySelectedModel
                        ? "rgba(16, 185, 129, 0.25)"
                        : "rgba(239, 68, 68, 0.25)"
                    }`,
                  }}
                >
                  <CheckCircle2 style={{ width: "10px", height: "10px" }} />
                  {req.label}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Candidate Score Breakdown Section (when available) */}
      {scoreBreakdown && scoreBreakdown.dimensions && scoreBreakdown.dimensions.length > 0 && (
        <div style={{ marginBottom: "0.85rem" }}>
          <button
            type="button"
            onClick={() => setShowDimensions(!showDimensions)}
            aria-expanded={showDimensions}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              background: "transparent",
              border: "none",
              padding: "0.35rem 0",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--nr-text-secondary, #cbd5e1)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <Layers style={{ width: "13px", height: "13px", color: "var(--nr-accent-cyan, #06b6d4)" }} />
              <span>Multi-Factor Score Breakdown ({scoreBreakdown.dimensions.length} Dimensions)</span>
            </span>
            {showDimensions ? (
              <ChevronDown style={{ width: "14px", height: "14px" }} />
            ) : (
              <ChevronRight style={{ width: "14px", height: "14px" }} />
            )}
          </button>

          {showDimensions && (
            <div
              data-testid="score-dimensions-container"
              style={{
                marginTop: "0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                padding: "0.6rem 0.8rem",
                borderRadius: "var(--nr-radius-sm, 4px)",
                backgroundColor: "rgba(255, 255, 255, 0.015)",
                border: "1px solid var(--nr-border-subtle, #1e222d)",
              }}
            >
              {scoreBreakdown.dimensions.map((dim: ScoreDimensionExplanationDto) => {
                const dimScorePercent = Math.round(dim.score * 100);
                return (
                  <div key={dim.key} style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.72rem",
                      }}
                    >
                      <span style={{ color: "var(--nr-text-primary, #e2e8f0)" }}>
                        {dim.label}
                        {dim.weightPercent ? (
                          <span style={{ color: "var(--nr-text-muted, #64748b)", marginLeft: "4px" }}>
                            ({dim.weightPercent}%)
                          </span>
                        ) : null}
                      </span>
                      <span
                        style={{
                          fontWeight: 600,
                          color:
                            dimScorePercent >= 80
                              ? "var(--nr-status-success, #34d399)"
                              : dimScorePercent >= 50
                              ? "var(--nr-accent-cyan, #38bdf8)"
                              : "var(--nr-status-warning, #f59e0b)",
                        }}
                      >
                        {dimScorePercent}%
                      </span>
                    </div>

                    {/* Accessible Progress Bar */}
                    <div
                      role="progressbar"
                      aria-valuenow={dimScorePercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${dim.label} suitability score`}
                      style={{
                        height: "5px",
                        width: "100%",
                        backgroundColor: "rgba(255, 255, 255, 0.06)",
                        borderRadius: "2px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${Math.min(100, Math.max(0, dimScorePercent))}%`,
                          backgroundColor:
                            dimScorePercent >= 80
                              ? "var(--nr-status-success, #10b981)"
                              : dimScorePercent >= 50
                              ? "var(--nr-accent-cyan, #06b6d4)"
                              : "var(--nr-status-warning, #f59e0b)",
                          transition: "width 0.2s ease",
                        }}
                      />
                    </div>

                    {dim.explanation && (
                      <span style={{ fontSize: "0.68rem", color: "var(--nr-text-muted, #64748b)" }}>
                        {dim.explanation}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Alternative Candidates Section */}
      {alternatives && alternatives.length > 1 && (
        <div style={{ marginBottom: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setShowAlternatives(!showAlternatives)}
            aria-expanded={showAlternatives}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              background: "transparent",
              border: "none",
              padding: "0.35rem 0",
              cursor: "pointer",
              fontSize: "0.75rem",
              fontWeight: 600,
              color: "var(--nr-text-secondary, #cbd5e1)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <HelpCircle style={{ width: "13px", height: "13px", color: "var(--nr-text-muted, #71717a)" }} />
              <span>Alternative Candidates Evaluated ({alternatives.length})</span>
            </span>
            {showAlternatives ? (
              <ChevronDown style={{ width: "14px", height: "14px" }} />
            ) : (
              <ChevronRight style={{ width: "14px", height: "14px" }} />
            )}
          </button>

          {showAlternatives && (
            <div
              data-testid="alternatives-container"
              style={{
                marginTop: "0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
              }}
            >
              {alternatives.map((alt) => (
                <div
                  key={`${alt.providerId}-${alt.modelId}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.45rem 0.65rem",
                    borderRadius: "var(--nr-radius-sm, 4px)",
                    backgroundColor: "rgba(255, 255, 255, 0.02)",
                    border: "1px solid var(--nr-border-subtle, #1e222d)",
                    fontSize: "0.74rem",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <span
                      style={{
                        color: "var(--nr-text-muted, #64748b)",
                        fontWeight: 600,
                        width: "14px",
                      }}
                    >
                      #{alt.rank}
                    </span>
                    <span style={{ color: "var(--nr-text-primary, #ffffff)" }}>
                      {alt.displayName || alt.modelId}
                    </span>
                    <span style={{ color: "var(--nr-text-muted, #64748b)" }}>
                      ({alt.providerName || alt.providerId})
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {alt.score !== null && alt.score !== undefined ? (
                      <span style={{ fontWeight: 600, color: "var(--nr-accent-cyan, #22d3ee)" }}>
                        {Math.round(alt.score * 100)}%
                      </span>
                    ) : (
                      <span style={{ color: "var(--nr-text-muted, #64748b)" }}>—</span>
                    )}
                    <span
                      style={{
                        fontSize: "0.68rem",
                        padding: "0.1rem 0.35rem",
                        borderRadius: "3px",
                        backgroundColor: alt.isEligible
                          ? "rgba(16, 185, 129, 0.12)"
                          : "rgba(239, 68, 68, 0.12)",
                        color: alt.isEligible
                          ? "var(--nr-status-success, #34d399)"
                          : "var(--nr-status-error, #f87171)",
                        border: `1px solid ${
                          alt.isEligible
                            ? "rgba(16, 185, 129, 0.25)"
                            : "rgba(239, 68, 68, 0.25)"
                        }`,
                      }}
                    >
                      {alt.isEligible ? "Eligible" : "Ineligible"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Policy Factors Section */}
      {policyFactors && policyFactors.length > 0 && (
        <div style={{ marginBottom: "0.6rem" }}>
          <div
            style={{
              fontSize: "0.72rem",
              fontWeight: 600,
              color: "var(--nr-text-secondary, #cbd5e1)",
              marginBottom: "0.3rem",
            }}
          >
            Policy Factors & Constraints
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {policyFactors.map((pf) => (
              <div
                key={pf.factor}
                style={{
                  fontSize: "0.68rem",
                  color: "var(--nr-text-muted, #94a3b8)",
                  display: "flex",
                  gap: "0.3rem",
                }}
              >
                <strong style={{ color: "var(--nr-text-secondary, #e2e8f0)" }}>{pf.label}:</strong>
                <span>{pf.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Semantic Notice Footer */}
      <div
        style={{
          marginTop: "0.75rem",
          paddingTop: "0.5rem",
          borderTop: "1px solid var(--nr-border-subtle, #1e222d)",
          fontSize: "0.68rem",
          color: "var(--nr-text-muted, #64748b)",
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
        }}
      >
        <Info style={{ width: "12px", height: "12px", flexShrink: 0 }} />
        <span>
          Local SLM analysis is privacy-preserving and executed on-device. Confidence score indicates intent classification certainty, not LLM response accuracy.
        </span>
      </div>
    </div>
  );
};
