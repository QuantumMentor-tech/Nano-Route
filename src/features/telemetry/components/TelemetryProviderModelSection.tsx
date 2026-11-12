/**
//! Nano Route — Step 42 Provider & Model Activity Tables
//! File: src/features/telemetry/components/TelemetryProviderModelSection.tsx
//!
//! Renders descriptive provider and model activity distributions with exact
//! counts, percentages, outcome breakdowns, historical indicators, and explicit
//! "View History" links. Strictly avoids model quality leaderboards or rankings.
*/

import React from "react";
import { ArrowUpRight, Cpu, Layers } from "lucide-react";
import type {
  TelemetryModelSummary,
  TelemetryProviderSummary,
} from "../types";

export interface TelemetryProviderModelSectionProps {
  providers: TelemetryProviderSummary[];
  models: TelemetryModelSummary[];
  onViewHistory: (providerId?: string, modelId?: string) => void;
}

export const TelemetryProviderModelSection: React.FC<
  TelemetryProviderModelSectionProps
> = ({ providers, models, onViewHistory }) => {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
        gap: "1rem",
      }}
    >
      {/* Provider Activity Summary Table */}
      <section
        aria-labelledby="telemetry-provider-table-heading"
        style={{
          borderRadius: "12px",
          border: "1px solid var(--nr-border-default, #27272a)",
          backgroundColor: "var(--nr-bg-surface, #111318)",
          padding: "1rem 1.15rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          minWidth: 0,
        }}
      >
        <div>
          <h3
            id="telemetry-provider-table-heading"
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
            <Layers
              size={15}
              style={{ color: "var(--nr-accent-blue, #38bdf8)" }}
              aria-hidden="true"
            />
            <span>Provider Activity Distribution</span>
          </h3>
          <p
            style={{
              margin: "0.18rem 0 0",
              fontSize: "0.75rem",
              color: "var(--nr-text-muted, #71717a)",
            }}
          >
            Ordered by request volume descending · includes historical providers
          </p>
        </div>

        {providers.length === 0 ? (
          <div
            role="status"
            style={{
              padding: "1.4rem 1rem",
              textAlign: "center",
              borderRadius: "8px",
              border: "1px dashed var(--nr-border-default, #27272a)",
              color: "var(--nr-text-muted, #71717a)",
              fontSize: "0.8rem",
            }}
          >
            No provider activity recorded in this filter scope.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              aria-label="Provider activity summary"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.78rem",
                textAlign: "left",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--nr-border-default, #27272a)",
                    color: "var(--nr-text-muted, #71717a)",
                  }}
                >
                  <th style={{ padding: "0.5rem 0.55rem" }}>Provider</th>
                  <th style={{ padding: "0.5rem 0.55rem", textAlign: "right" }}>
                    Requests
                  </th>
                  <th style={{ padding: "0.5rem 0.55rem", textAlign: "right" }}>
                    Share
                  </th>
                  <th style={{ padding: "0.5rem 0.55rem", textAlign: "right" }}>
                    Outcomes (S / F / C)
                  </th>
                  <th style={{ padding: "0.5rem 0.55rem", textAlign: "right" }}>
                    History
                  </th>
                </tr>
              </thead>
              <tbody>
                {providers.map((prov) => {
                  const pct = prov.percentageOfTotal ?? 0;
                  const canInspectHistory = prov.providerId !== "unrecorded";
                  return (
                    <tr
                      key={prov.providerId}
                      style={{
                        borderBottom:
                          "1px solid var(--nr-border-subtle, #1f222b)",
                        color: "var(--nr-text-primary, #f4f4f5)",
                      }}
                    >
                      <td style={{ padding: "0.55rem" }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            flexWrap: "wrap",
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>
                            {prov.displayName}
                          </span>
                          {prov.isHistoricalOrUnrecorded && (
                            <span
                              style={{
                                fontSize: "0.66rem",
                                padding: "0.08rem 0.4rem",
                                borderRadius: "9999px",
                                backgroundColor:
                                  "var(--nr-bg-surface-elevated, #181b22)",
                                border:
                                  "1px solid var(--nr-border-default, #27272a)",
                                color: "var(--nr-text-muted, #71717a)",
                              }}
                            >
                              {prov.providerId === "unrecorded"
                                ? "Unrecorded"
                                : "Historical"}
                            </span>
                          )}
                        </div>
                        <div
                          style={{
                            marginTop: "0.28rem",
                            width: "100%",
                            maxWidth: "140px",
                            height: "4px",
                            borderRadius: "9999px",
                            backgroundColor:
                              "var(--nr-bg-surface-elevated, #181b22)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, pct)}%`,
                              height: "100%",
                              backgroundColor: "var(--nr-accent-blue, #38bdf8)",
                            }}
                          />
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "0.55rem",
                          textAlign: "right",
                          fontWeight: 600,
                        }}
                      >
                        {prov.requestCount.toLocaleString()}
                      </td>
                      <td
                        style={{
                          padding: "0.55rem",
                          textAlign: "right",
                          color: "var(--nr-text-secondary, #a1a1aa)",
                        }}
                      >
                        {prov.percentageOfTotal !== null
                          ? `${prov.percentageOfTotal.toFixed(1)}%`
                          : "—"}
                      </td>
                      <td
                        style={{
                          padding: "0.55rem",
                          textAlign: "right",
                          color: "var(--nr-text-secondary, #a1a1aa)",
                        }}
                      >
                        {prov.successCount} / {prov.failureCount} /{" "}
                        {prov.cancelledCount}
                      </td>
                      <td style={{ padding: "0.55rem", textAlign: "right" }}>
                        {canInspectHistory ? (
                          <button
                            type="button"
                            onClick={() => onViewHistory(prov.providerId)}
                            aria-label={`View history for provider ${prov.displayName}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              padding: "0.22rem 0.5rem",
                              borderRadius: "6px",
                              fontSize: "0.72rem",
                              backgroundColor: "transparent",
                              border:
                                "1px solid var(--nr-border-default, #27272a)",
                              color: "var(--nr-accent-blue, #38bdf8)",
                              cursor: "pointer",
                            }}
                          >
                            <span>View History</span>
                            <ArrowUpRight size={11} aria-hidden="true" />
                          </button>
                        ) : (
                          <span
                            style={{ color: "var(--nr-text-muted, #71717a)" }}
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Model Activity Summary Table */}
      <section
        aria-labelledby="telemetry-model-table-heading"
        style={{
          borderRadius: "12px",
          border: "1px solid var(--nr-border-default, #27272a)",
          backgroundColor: "var(--nr-bg-surface, #111318)",
          padding: "1rem 1.15rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          minWidth: 0,
        }}
      >
        <div>
          <h3
            id="telemetry-model-table-heading"
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
            <Cpu
              size={15}
              style={{ color: "var(--nr-accent-purple, #a855f7)" }}
              aria-hidden="true"
            />
            <span>Model Activity Distribution</span>
          </h3>
          <p
            style={{
              margin: "0.18rem 0 0",
              fontSize: "0.75rem",
              color: "var(--nr-text-muted, #71717a)",
            }}
          >
            Ordered by request count desc, provider asc, model asc
          </p>
        </div>

        {models.length === 0 ? (
          <div
            role="status"
            style={{
              padding: "1.4rem 1rem",
              textAlign: "center",
              borderRadius: "8px",
              border: "1px dashed var(--nr-border-default, #27272a)",
              color: "var(--nr-text-muted, #71717a)",
              fontSize: "0.8rem",
            }}
          >
            No model activity recorded in this filter scope.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table
              aria-label="Model activity summary"
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.78rem",
                textAlign: "left",
              }}
            >
              <thead>
                <tr
                  style={{
                    borderBottom: "1px solid var(--nr-border-default, #27272a)",
                    color: "var(--nr-text-muted, #71717a)",
                  }}
                >
                  <th style={{ padding: "0.5rem 0.55rem" }}>Provider</th>
                  <th style={{ padding: "0.5rem 0.55rem" }}>Model</th>
                  <th style={{ padding: "0.5rem 0.55rem", textAlign: "right" }}>
                    Requests
                  </th>
                  <th style={{ padding: "0.5rem 0.55rem", textAlign: "right" }}>
                    Outcomes (S / F / C)
                  </th>
                  <th style={{ padding: "0.5rem 0.55rem", textAlign: "right" }}>
                    History
                  </th>
                </tr>
              </thead>
              <tbody>
                {models.map((mdl) => {
                  const canInspectHistory =
                    mdl.providerId !== "unrecorded" &&
                    mdl.modelId !== "unrecorded";
                  return (
                    <tr
                      key={`${mdl.providerId}::${mdl.modelId}`}
                      style={{
                        borderBottom:
                          "1px solid var(--nr-border-subtle, #1f222b)",
                        color: "var(--nr-text-primary, #f4f4f5)",
                      }}
                    >
                      <td
                        style={{
                          padding: "0.55rem",
                          color: "var(--nr-text-secondary, #a1a1aa)",
                        }}
                      >
                        {mdl.providerDisplayName}
                      </td>
                      <td style={{ padding: "0.55rem", fontWeight: 600 }}>
                        {mdl.modelId === "unrecorded"
                          ? "Not recorded"
                          : mdl.modelId}
                      </td>
                      <td
                        style={{
                          padding: "0.55rem",
                          textAlign: "right",
                          fontWeight: 600,
                        }}
                      >
                        {mdl.requestCount.toLocaleString()}
                        {mdl.percentageOfTotal !== null ? (
                          <span
                            style={{
                              marginLeft: "0.3rem",
                              fontWeight: 400,
                              color: "var(--nr-text-muted, #71717a)",
                            }}
                          >
                            ({mdl.percentageOfTotal.toFixed(1)}%)
                          </span>
                        ) : null}
                      </td>
                      <td
                        style={{
                          padding: "0.55rem",
                          textAlign: "right",
                          color: "var(--nr-text-secondary, #a1a1aa)",
                        }}
                      >
                        {mdl.successCount} / {mdl.failureCount} /{" "}
                        {mdl.cancelledCount}
                      </td>
                      <td style={{ padding: "0.55rem", textAlign: "right" }}>
                        {canInspectHistory ? (
                          <button
                            type="button"
                            onClick={() =>
                              onViewHistory(mdl.providerId, mdl.modelId)
                            }
                            aria-label={`View history for ${mdl.providerDisplayName} ${mdl.modelId}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.25rem",
                              padding: "0.22rem 0.5rem",
                              borderRadius: "6px",
                              fontSize: "0.72rem",
                              backgroundColor: "transparent",
                              border:
                                "1px solid var(--nr-border-default, #27272a)",
                              color: "var(--nr-accent-blue, #38bdf8)",
                              cursor: "pointer",
                            }}
                          >
                            <span>View History</span>
                            <ArrowUpRight size={11} aria-hidden="true" />
                          </button>
                        ) : (
                          <span
                            style={{ color: "var(--nr-text-muted, #71717a)" }}
                          >
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

