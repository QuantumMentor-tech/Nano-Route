/**
//! Nano Route — Step 42 Telemetry Dashboard Header
//! File: src/features/telemetry/components/TelemetryHeader.tsx
//!
//! Displays the dashboard title, concise operational subtitle, active time-range
//! label, telemetry freshness status badge, and manual Refresh control.
*/

import React from "react";
import { Activity, Clock, RefreshCw } from "lucide-react";
import type { TelemetryFreshnessStatus } from "../types";

export interface TelemetryHeaderProps {
  dateRangeLabel: string;
  freshnessStatus: TelemetryFreshnessStatus;
  freshnessLabel: string;
  lastUpdatedAtMs: number | null;
  isStale: boolean;
  isRefreshing: boolean;
  onRefresh: () => void | Promise<void>;
}

export const TelemetryHeader: React.FC<TelemetryHeaderProps> = ({
  dateRangeLabel,
  freshnessStatus,
  freshnessLabel,
  lastUpdatedAtMs,
  isStale,
  isRefreshing,
  onRefresh,
}) => {
  const formattedUpdatedTime =
    lastUpdatedAtMs && Number.isFinite(lastUpdatedAtMs)
      ? new Date(lastUpdatedAtMs).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : null;

  const badgeColors = (() => {
    if (isStale) {
      return {
        bg: "rgba(251, 191, 36, 0.14)",
        border: "rgba(251, 191, 36, 0.4)",
        text: "#fbbf24",
      };
    }
    switch (freshnessStatus) {
      case "up_to_date":
        return {
          bg: "rgba(34, 197, 94, 0.14)",
          border: "rgba(34, 197, 94, 0.35)",
          text: "#4ade80",
        };
      case "updated_recently":
        return {
          bg: "rgba(56, 189, 248, 0.14)",
          border: "rgba(56, 189, 248, 0.35)",
          text: "var(--nr-accent-blue, #38bdf8)",
        };
      case "unavailable":
        return {
          bg: "rgba(239, 68, 68, 0.14)",
          border: "rgba(239, 68, 68, 0.35)",
          text: "#fca5a5",
        };
      default:
        return {
          bg: "var(--nr-bg-surface-elevated, #181b22)",
          border: "var(--nr-border-default, #27272a)",
          text: "var(--nr-text-secondary, #a1a1aa)",
        };
    }
  })();

  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        padding: "1rem 1.15rem",
        borderRadius: "12px",
        backgroundColor: "var(--nr-bg-surface, #111318)",
        border: "1px solid var(--nr-border-default, #27272a)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div
          style={{
            width: "38px",
            height: "38px",
            borderRadius: "10px",
            backgroundColor: "rgba(168, 85, 247, 0.15)",
            border: "1px solid rgba(168, 85, 247, 0.38)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--nr-accent-purple, #a855f7)",
            flexShrink: 0,
          }}
        >
          <Activity size={19} aria-hidden="true" />
        </div>
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "1.15rem",
              fontWeight: 600,
              color: "var(--nr-text-primary, #f4f4f5)",
            }}
          >
            Telemetry
          </h2>
          <p
            style={{
              margin: "0.18rem 0 0",
              fontSize: "0.8rem",
              color: "var(--nr-text-secondary, #a1a1aa)",
            }}
          >
            Monitor local routing activity, execution outcomes, and model usage.
          </p>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.6rem",
        }}
      >
        <span
          aria-label={`Selected period: ${dateRangeLabel}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.35rem 0.68rem",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
            border: "1px solid var(--nr-border-default, #27272a)",
            color: "var(--nr-text-secondary, #a1a1aa)",
          }}
        >
          <Clock size={12} aria-hidden="true" />
          <span>{dateRangeLabel}</span>
        </span>

        <span
          role="status"
          aria-live="polite"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.35rem 0.68rem",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            backgroundColor: badgeColors.bg,
            border: `1px solid ${badgeColors.border}`,
            color: badgeColors.text,
          }}
        >
          <span>
            {isStale
              ? "Showing last valid snapshot"
              : freshnessLabel}
          </span>
          {formattedUpdatedTime && (
            <span style={{ opacity: 0.85 }}>· {formattedUpdatedTime}</span>
          )}
        </span>

        <button
          type="button"
          disabled={isRefreshing}
          onClick={() => void onRefresh()}
          aria-label="Refresh telemetry data"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.42rem 0.82rem",
            borderRadius: "8px",
            fontSize: "0.78rem",
            fontWeight: 500,
            backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
            color: "var(--nr-text-primary, #f4f4f5)",
            border: "1px solid var(--nr-border-default, #27272a)",
            cursor: isRefreshing ? "wait" : "pointer",
          }}
        >
          <RefreshCw
            size={13}
            style={{
              animation: isRefreshing ? "spin 1s linear infinite" : undefined,
            }}
            aria-hidden="true"
          />
          <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>
    </header>
  );
};

