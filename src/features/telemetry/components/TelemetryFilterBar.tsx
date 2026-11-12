/**
//! Nano Route — Step 42 Telemetry Dashboard Filter Bar
//! File: src/features/telemetry/components/TelemetryFilterBar.tsx
//!
//! Accessible controls for filtering telemetry by local date range, historical
//! provider, historical model, canonical execution outcome, and event type.
*/

import React from "react";
import { Filter, RotateCcw } from "lucide-react";
import { formatOutcomeLabel } from "../../../services/ipc/telemetry";
import type {
  TelemetryDatePreset,
  TelemetryFilterOptionsDto,
} from "../types";

export interface TelemetryFilterBarProps {
  datePreset: TelemetryDatePreset;
  onDatePresetChange: (preset: TelemetryDatePreset) => void;
  customDateFrom: string;
  onCustomDateFromChange: (val: string) => void;
  customDateTo: string;
  onCustomDateToChange: (val: string) => void;
  providerFilter: string;
  onProviderFilterChange: (providerId: string) => void;
  modelFilter: string;
  onModelFilterChange: (modelId: string) => void;
  outcomeFilter: string;
  onOutcomeFilterChange: (outcome: string) => void;
  eventTypeFilter: string;
  onEventTypeFilterChange: (eventType: string) => void;
  filterOptions: TelemetryFilterOptionsDto;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  dateRangeValidationError: string | null;
}

const selectStyle: React.CSSProperties = {
  backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
  color: "var(--nr-text-primary, #f4f4f5)",
  border: "1px solid var(--nr-border-default, #27272a)",
  borderRadius: "8px",
  padding: "0.4rem 0.65rem",
  fontSize: "0.79rem",
  minHeight: "34px",
  outline: "none",
  cursor: "pointer",
};

const CANONICAL_OUTCOMES = [
  "success",
  "failure",
  "cancelled",
  "timeout",
  "rate_limited",
  "unavailable",
  "fallback",
];

export const TelemetryFilterBar: React.FC<TelemetryFilterBarProps> = ({
  datePreset,
  onDatePresetChange,
  customDateFrom,
  onCustomDateFromChange,
  customDateTo,
  onCustomDateToChange,
  providerFilter,
  onProviderFilterChange,
  modelFilter,
  onModelFilterChange,
  outcomeFilter,
  onOutcomeFilterChange,
  eventTypeFilter,
  onEventTypeFilterChange,
  filterOptions,
  hasActiveFilters,
  onResetFilters,
  dateRangeValidationError,
}) => {
  // Combine canonical outcomes with any additional persisted outcomes
  const outcomeChoices = Array.from(
    new Set([...CANONICAL_OUTCOMES, ...filterOptions.outcomes])
  );

  // Filter model options by selected provider when a provider filter is active
  const visibleModels = providerFilter
    ? filterOptions.models.filter(
        (m) => !m.providerId || m.providerId === providerFilter
      )
    : filterOptions.models;

  const uniqueModelIds = Array.from(
    new Set(visibleModels.map((m) => m.modelId))
  );

  return (
    <section
      aria-label="Telemetry dashboard filters"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.7rem",
        padding: "0.85rem 1rem",
        borderRadius: "12px",
        backgroundColor: "var(--nr-bg-surface, #111318)",
        border: "1px solid var(--nr-border-default, #27272a)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.65rem",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            fontSize: "0.76rem",
            fontWeight: 600,
            color: "var(--nr-text-secondary, #a1a1aa)",
            marginRight: "0.2rem",
          }}
        >
          <Filter size={13} aria-hidden="true" />
          <span>Filters</span>
        </span>

        {/* Date Range */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.38rem" }}>
          <label
            htmlFor="telemetry-date-preset"
            style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}
          >
            Period
          </label>
          <select
            id="telemetry-date-preset"
            aria-label="Filter telemetry by time range"
            value={datePreset}
            onChange={(e) =>
              onDatePresetChange(e.target.value as TelemetryDatePreset)
            }
            style={selectStyle}
          >
            <option value="all">All available data</option>
            <option value="today">Today</option>
            <option value="last_7_days">Last 7 days</option>
            <option value="last_30_days">Last 30 days</option>
            <option value="custom">Custom range</option>
          </select>
        </div>

        {datePreset === "custom" && (
          <div
            style={{
              display: "inline-flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <label
              htmlFor="telemetry-custom-from"
              style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}
            >
              From
            </label>
            <input
              id="telemetry-custom-from"
              type="date"
              value={customDateFrom}
              onChange={(e) => onCustomDateFromChange(e.target.value)}
              style={selectStyle}
            />
            <label
              htmlFor="telemetry-custom-to"
              style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}
            >
              To
            </label>
            <input
              id="telemetry-custom-to"
              type="date"
              value={customDateTo}
              onChange={(e) => onCustomDateToChange(e.target.value)}
              style={selectStyle}
            />
          </div>
        )}

        {/* Provider */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.38rem" }}>
          <label
            htmlFor="telemetry-provider-filter"
            style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}
          >
            Provider
          </label>
          <select
            id="telemetry-provider-filter"
            aria-label="Filter telemetry by provider"
            value={providerFilter}
            onChange={(e) => onProviderFilterChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Providers</option>
            {filterOptions.providers.map((p) => (
              <option key={p.providerId} value={p.providerId}>
                {p.displayName}
                {p.isHistorical ? ` (${p.providerId} · historical)` : ""}
              </option>
            ))}
            <option value="unrecorded">Not recorded</option>
          </select>
        </div>

        {/* Model */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.38rem" }}>
          <label
            htmlFor="telemetry-model-filter"
            style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}
          >
            Model
          </label>
          <select
            id="telemetry-model-filter"
            aria-label="Filter telemetry by model"
            value={modelFilter}
            onChange={(e) => onModelFilterChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Models</option>
            {uniqueModelIds.map((modelId) => (
              <option key={modelId} value={modelId}>
                {modelId}
              </option>
            ))}
            <option value="unrecorded">Not recorded</option>
          </select>
        </div>

        {/* Execution Outcome */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.38rem" }}>
          <label
            htmlFor="telemetry-outcome-filter"
            style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}
          >
            Outcome
          </label>
          <select
            id="telemetry-outcome-filter"
            aria-label="Filter telemetry by execution outcome"
            value={outcomeFilter}
            onChange={(e) => onOutcomeFilterChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Outcomes</option>
            {outcomeChoices.map((outcome) => (
              <option key={outcome} value={outcome}>
                {formatOutcomeLabel(outcome)}
              </option>
            ))}
          </select>
        </div>

        {/* Event Type */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.38rem" }}>
          <label
            htmlFor="telemetry-event-filter"
            style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}
          >
            Category
          </label>
          <select
            id="telemetry-event-filter"
            aria-label="Filter telemetry by event category"
            value={eventTypeFilter}
            onChange={(e) => onEventTypeFilterChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">All Event Categories</option>
            <option value="provider_execution">Provider Execution</option>
            <option value="stream_lifecycle">Stream Lifecycle</option>
            <option value="routing_decision">Routing Decision</option>
            <option value="fallback_transition">Fallback Transition</option>
            <option value="system_event">System Event</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.38rem 0.7rem",
              borderRadius: "8px",
              fontSize: "0.76rem",
              backgroundColor: "transparent",
              color: "var(--nr-accent-blue, #38bdf8)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={12} aria-hidden="true" />
            <span>Reset filters</span>
          </button>
        )}
      </div>

      {dateRangeValidationError && (
        <div
          role="alert"
          style={{
            fontSize: "0.76rem",
            color: "#fbbf24",
          }}
        >
          {dateRangeValidationError}
        </div>
      )}
    </section>
  );
};

