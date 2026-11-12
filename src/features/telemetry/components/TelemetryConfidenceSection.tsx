/**
//! Nano Route — Step 42 SLM Classifier Confidence Distribution
//! File: src/features/telemetry/components/TelemetryConfidenceSection.tsx
//!
//! Displays the recorded Step 27 SLM classifier confidence distribution across
//! 4 buckets (`0.00–0.24`, `0.25–0.49`, `0.50–0.74`, `0.75–1.00`) and explicitly
//! distinguishes recorded vs. missing confidence without implying answer quality.
*/

import React from "react";
import { Gauge } from "lucide-react";
import type { TelemetryConfidenceDistribution } from "../types";

export interface TelemetryConfidenceSectionProps {
  distribution: TelemetryConfidenceDistribution;
}

export const TelemetryConfidenceSection: React.FC<
  TelemetryConfidenceSectionProps
> = ({ distribution }) => {
  const hasConfidenceData = distribution.availableCount > 0;

  return (
    <section
      aria-labelledby="telemetry-confidence-heading"
      style={{
        borderRadius: "12px",
        border: "1px solid var(--nr-border-default, #27272a)",
        backgroundColor: "var(--nr-bg-surface, #111318)",
        padding: "1rem 1.15rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.65rem",
        }}
      >
        <div>
          <h3
            id="telemetry-confidence-heading"
            style={{
              margin: 0,
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "var(--nr-text-primary, #f4f4f5)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            <Gauge
              size={15}
              style={{ color: "var(--nr-accent-purple, #a855f7)" }}
              aria-hidden="true"
            />
            <span>Recorded SLM Classifier Confidence Distribution</span>
          </h3>
          <p
            style={{
              margin: "0.18rem 0 0",
              fontSize: "0.75rem",
              color: "var(--nr-text-muted, #71717a)",
            }}
          >
            Represents recorded Step 27 intent/routing classifier confidence (not model response quality or accuracy).
          </p>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.55rem",
            fontSize: "0.74rem",
            color: "var(--nr-text-secondary, #a1a1aa)",
          }}
        >
          <span>
            Available: {distribution.availableCount.toLocaleString()}
          </span>
          <span>·</span>
          <span>
            Not recorded: {distribution.missingCount.toLocaleString()}
          </span>
          {hasConfidenceData &&
            distribution.minConfidence !== null &&
            distribution.maxConfidence !== null && (
              <>
                <span>·</span>
                <span>
                  Range: {distribution.minConfidence.toFixed(2)} –{" "}
                  {distribution.maxConfidence.toFixed(2)}
                </span>
              </>
            )}
        </div>
      </div>

      {!hasConfidenceData ? (
        <div
          role="status"
          style={{
            padding: "1.4rem 1rem",
            textAlign: "center",
            borderRadius: "8px",
            border: "1px dashed var(--nr-border-default, #27272a)",
            color: "var(--nr-text-secondary, #a1a1aa)",
            fontSize: "0.82rem",
          }}
        >
          <strong style={{ color: "var(--nr-text-primary, #f4f4f5)" }}>
            Confidence unavailable
          </strong>
          <div
            style={{
              marginTop: "0.25rem",
              fontSize: "0.76rem",
              color: "var(--nr-text-muted, #71717a)",
            }}
          >
            The selected telemetry records do not contain confidence data.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {distribution.buckets.map((bucket) => {
            const pct = bucket.percentageOfAvailable ?? 0;
            return (
              <div
                key={bucket.bucketKey}
                style={{
                  padding: "0.75rem 0.85rem",
                  borderRadius: "9px",
                  backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                  border: "1px solid var(--nr-border-subtle, #1f222b)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.4rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "0.78rem",
                  }}
                >
                  <span
                    style={{
                      fontWeight: 600,
                      color: "var(--nr-text-primary, #f4f4f5)",
                    }}
                  >
                    {bucket.label}
                  </span>
                  <span style={{ color: "var(--nr-text-secondary, #a1a1aa)" }}>
                    {bucket.count.toLocaleString()}
                    {bucket.percentageOfAvailable !== null
                      ? ` (${bucket.percentageOfAvailable.toFixed(1)}%)`
                      : ""}
                  </span>
                </div>

                <div
                  style={{
                    width: "100%",
                    height: "6px",
                    borderRadius: "9999px",
                    backgroundColor: "var(--nr-bg-surface, #111318)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      height: "100%",
                      backgroundColor: "var(--nr-accent-purple, #a855f7)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

