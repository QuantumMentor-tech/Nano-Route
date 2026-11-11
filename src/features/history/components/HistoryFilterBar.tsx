/**
//! Nano Route — History Explorer Search & Filter Toolbar
//! File: src/features/history/components/HistoryFilterBar.tsx
//!
//! Accessible search bar, persisted-provider/model filter selectors, date range
//! presets (including local custom dates), pinned filter toggle, and sort mode.
*/

import React from "react";
import { Pin, RotateCcw, SlidersHorizontal } from "lucide-react";
import { SearchField } from "../../../components/forms/SearchField";
import type {
  HistoryDatePreset,
  HistoryFilterOptions,
  HistorySearchEngine,
  HistorySortMode,
} from "../types";

export interface HistoryFilterBarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  onClearSearch: () => void;
  sortMode: HistorySortMode;
  onSortChange: (sort: HistorySortMode) => void;
  providerFilter: string;
  onProviderChange: (provider: string) => void;
  modelFilter: string;
  onModelChange: (model: string) => void;
  pinnedOnly: boolean;
  onPinnedOnlyChange: (pinnedOnly: boolean) => void;
  datePreset: HistoryDatePreset;
  onDatePresetChange: (preset: HistoryDatePreset) => void;
  customDateFrom: string;
  onCustomDateFromChange: (dateStr: string) => void;
  customDateTo: string;
  onCustomDateToChange: (dateStr: string) => void;
  filterOptions: HistoryFilterOptions;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  isSearchMode: boolean;
  isSearching?: boolean;
  searchEngineUsed?: HistorySearchEngine | null;
  searchDurationMs?: number | null;
}

const selectStyle: React.CSSProperties = {
  backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
  color: "var(--nr-text-primary, #f4f4f5)",
  border: "1px solid var(--nr-border-default, #27272a)",
  borderRadius: "8px",
  padding: "0.42rem 0.65rem",
  fontSize: "0.8rem",
  outline: "none",
  minHeight: "34px",
  cursor: "pointer",
};

export const HistoryFilterBar: React.FC<HistoryFilterBarProps> = ({
  searchInput,
  onSearchChange,
  onClearSearch,
  sortMode,
  onSortChange,
  providerFilter,
  onProviderChange,
  modelFilter,
  onModelChange,
  pinnedOnly,
  onPinnedOnlyChange,
  datePreset,
  onDatePresetChange,
  customDateFrom,
  onCustomDateFromChange,
  customDateTo,
  onCustomDateToChange,
  filterOptions,
  hasActiveFilters,
  onResetFilters,
  isSearchMode,
  isSearching = false,
  searchEngineUsed = null,
  searchDurationMs = null,
}) => {
  const customRangeInvalid =
    datePreset === "custom" &&
    Boolean(customDateFrom) &&
    Boolean(customDateTo) &&
    customDateFrom > customDateTo;

  return (
    <section
      aria-label="Search and filter conversation history"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        padding: "0.9rem 1rem",
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
          gap: "0.75rem",
        }}
      >
        <div style={{ flex: "1 1 280px", minWidth: "220px" }}>
          <SearchField
            aria-label="Search conversation titles and messages"
            placeholder="Search conversation titles and messages..."
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            onClear={onClearSearch}
          />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          <label
            htmlFor="history-sort-select"
            style={{
              fontSize: "0.75rem",
              color: "var(--nr-text-secondary, #a1a1aa)",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <SlidersHorizontal size={13} aria-hidden="true" />
            <span>Sort</span>
          </label>
          <select
            id="history-sort-select"
            aria-label="Sort conversations"
            value={sortMode}
            onChange={(e) => onSortChange(e.target.value as HistorySortMode)}
            style={selectStyle}
          >
            <option value="most_recent">Most recent activity</option>
            <option value="oldest">Oldest activity</option>
            <option value="pinned_first">Pinned first</option>
            <option value="recently_created">Recently created</option>
            <option value="oldest_created">Oldest created</option>
          </select>

          <button
            type="button"
            aria-pressed={pinnedOnly}
            onClick={() => onPinnedOnlyChange(!pinnedOnly)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.42rem 0.7rem",
              borderRadius: "8px",
              fontSize: "0.8rem",
              minHeight: "34px",
              cursor: "pointer",
              border: pinnedOnly
                ? "1px solid var(--nr-accent-purple, #a855f7)"
                : "1px solid var(--nr-border-default, #27272a)",
              backgroundColor: pinnedOnly
                ? "rgba(168, 85, 247, 0.16)"
                : "var(--nr-bg-surface-elevated, #181b22)",
              color: pinnedOnly
                ? "var(--nr-text-primary, #f4f4f5)"
                : "var(--nr-text-secondary, #a1a1aa)",
            }}
          >
            <Pin size={13} aria-hidden="true" />
            <span>Pinned only</span>
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.65rem",
        }}
      >
        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <label
            htmlFor="history-provider-filter"
            style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}
          >
            Provider
          </label>
          <select
            id="history-provider-filter"
            aria-label="Filter by historical provider"
            value={providerFilter}
            onChange={(e) => onProviderChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">All providers</option>
            {filterOptions.providers.map((provider) => (
              <option key={provider} value={provider}>
                {provider}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <label
            htmlFor="history-model-filter"
            style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}
          >
            Model
          </label>
          <select
            id="history-model-filter"
            aria-label="Filter by historical model"
            value={modelFilter}
            onChange={(e) => onModelChange(e.target.value)}
            style={selectStyle}
          >
            <option value="">All models</option>
            {filterOptions.models.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
          <label
            htmlFor="history-date-preset"
            style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}
          >
            Date range
          </label>
          <select
            id="history-date-preset"
            aria-label="Filter by date range"
            value={datePreset}
            onChange={(e) => onDatePresetChange(e.target.value as HistoryDatePreset)}
            style={selectStyle}
          >
            <option value="all">All dates</option>
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
              gap: "0.45rem",
            }}
          >
            <label
              htmlFor="history-date-from"
              style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}
            >
              From
            </label>
            <input
              id="history-date-from"
              type="date"
              value={customDateFrom}
              onChange={(e) => onCustomDateFromChange(e.target.value)}
              style={selectStyle}
            />
            <label
              htmlFor="history-date-to"
              style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}
            >
              To
            </label>
            <input
              id="history-date-to"
              type="date"
              value={customDateTo}
              onChange={(e) => onCustomDateToChange(e.target.value)}
              style={selectStyle}
            />
          </div>
        )}

        <div
          style={{
            marginLeft: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.6rem",
          }}
        >
          {isSearchMode && (
            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              {isSearching
                ? "Searching local index..."
                : searchEngineUsed
                  ? `${searchEngineUsed === "fts5" ? "FTS5" : "SQL fallback"}${
                      typeof searchDurationMs === "number" ? ` · ${searchDurationMs}ms` : ""
                    }`
                  : null}
            </span>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.38rem 0.65rem",
                borderRadius: "8px",
                fontSize: "0.78rem",
                backgroundColor: "transparent",
                color: "var(--nr-accent-blue, #38bdf8)",
                border: "1px solid rgba(56, 189, 248, 0.35)",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Reset filters</span>
            </button>
          )}
        </div>
      </div>

      {customRangeInvalid && (
        <div
          role="alert"
          style={{
            fontSize: "0.78rem",
            color: "#fbbf24",
          }}
        >
          Start date must be on or before end date.
        </div>
      )}
    </section>
  );
};

