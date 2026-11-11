/**
//! Nano Route — History Explorer Empty State Component
//! File: src/features/history/components/HistoryEmptyState.tsx
//!
//! Differentiates true empty history, no search matches, and no filter matches
//! without ever invoking AI routing or rendering unescaped HTML.
*/

import React from "react";
import { FilterX, History, MessageSquarePlus, SearchX } from "lucide-react";

export interface HistoryEmptyStateProps {
  isSearchMode: boolean;
  searchQuery: string;
  hasActiveFilters: boolean;
  onClearSearch: () => void;
  onResetFilters: () => void;
  onOpenChatStudio: () => void;
}

export const HistoryEmptyState: React.FC<HistoryEmptyStateProps> = ({
  isSearchMode,
  searchQuery,
  hasActiveFilters,
  onClearSearch,
  onResetFilters,
  onOpenChatStudio,
}) => {
  if (isSearchMode) {
    return (
      <div
        role="status"
        style={{
          padding: "2.25rem 1.5rem",
          borderRadius: "12px",
          border: "1px dashed var(--nr-border-default, #27272a)",
          backgroundColor: "var(--nr-bg-surface, #111318)",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <SearchX
          size={32}
          style={{ color: "var(--nr-text-muted, #71717a)" }}
          aria-hidden="true"
        />
        <h3
          style={{
            margin: 0,
            fontSize: "0.98rem",
            fontWeight: 600,
            color: "var(--nr-text-primary, #f4f4f5)",
          }}
        >
          No matching conversations found
        </h3>
        <p
          style={{
            margin: 0,
            maxWidth: "420px",
            fontSize: "0.84rem",
            color: "var(--nr-text-secondary, #a1a1aa)",
            lineHeight: 1.5,
            wordBreak: "break-word",
          }}
        >
          No local conversation titles or messages matched &ldquo;{searchQuery}&rdquo;
          {hasActiveFilters ? " under the current filter criteria." : "."}
        </p>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
          <button
            type="button"
            onClick={onClearSearch}
            style={{
              padding: "0.45rem 0.9rem",
              borderRadius: "8px",
              fontSize: "0.82rem",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              color: "var(--nr-text-primary, #f4f4f5)",
              border: "1px solid var(--nr-border-default, #27272a)",
              cursor: "pointer",
            }}
          >
            Clear search
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: "8px",
                fontSize: "0.82rem",
                backgroundColor: "rgba(56, 189, 248, 0.14)",
                color: "var(--nr-accent-blue, #38bdf8)",
                border: "1px solid rgba(56, 189, 248, 0.35)",
                cursor: "pointer",
              }}
            >
              Reset all filters
            </button>
          )}
        </div>
      </div>
    );
  }

  if (hasActiveFilters) {
    return (
      <div
        role="status"
        style={{
          padding: "2.25rem 1.5rem",
          borderRadius: "12px",
          border: "1px dashed var(--nr-border-default, #27272a)",
          backgroundColor: "var(--nr-bg-surface, #111318)",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <FilterX
          size={32}
          style={{ color: "var(--nr-text-muted, #71717a)" }}
          aria-hidden="true"
        />
        <h3
          style={{
            margin: 0,
            fontSize: "0.98rem",
            fontWeight: 600,
            color: "var(--nr-text-primary, #f4f4f5)",
          }}
        >
          No conversations match your filters
        </h3>
        <p
          style={{
            margin: 0,
            maxWidth: "400px",
            fontSize: "0.84rem",
            color: "var(--nr-text-secondary, #a1a1aa)",
            lineHeight: 1.5,
          }}
        >
          Try clearing the provider, model, date range, or pinned filter to view more stored conversations.
        </p>
        <button
          type="button"
          onClick={onResetFilters}
          style={{
            marginTop: "0.25rem",
            padding: "0.45rem 0.95rem",
            borderRadius: "8px",
            fontSize: "0.82rem",
            backgroundColor: "rgba(56, 189, 248, 0.14)",
            color: "var(--nr-accent-blue, #38bdf8)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            cursor: "pointer",
          }}
        >
          Reset filters
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      style={{
        padding: "2.5rem 1.5rem",
        borderRadius: "12px",
        border: "1px dashed var(--nr-border-default, #27272a)",
        backgroundColor: "var(--nr-bg-surface, #111318)",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "0.75rem",
      }}
    >
      <History
        size={34}
        style={{ color: "var(--nr-accent-purple, #a855f7)" }}
        aria-hidden="true"
      />
      <h3
        style={{
          margin: 0,
          fontSize: "1rem",
          fontWeight: 600,
          color: "var(--nr-text-primary, #f4f4f5)",
        }}
      >
        No saved conversations yet
      </h3>
      <p
        style={{
          margin: 0,
          maxWidth: "420px",
          fontSize: "0.84rem",
          color: "var(--nr-text-secondary, #a1a1aa)",
          lineHeight: 1.5,
        }}
      >
        Conversations created in Chat Studio are stored locally in encrypted-at-rest OS storage and appear here for instant search and review.
      </p>
      <button
        type="button"
        onClick={onOpenChatStudio}
        style={{
          marginTop: "0.25rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.45rem",
          padding: "0.5rem 1rem",
          borderRadius: "8px",
          fontSize: "0.84rem",
          fontWeight: 500,
          backgroundColor: "rgba(168, 85, 247, 0.18)",
          color: "var(--nr-text-primary, #f4f4f5)",
          border: "1px solid rgba(168, 85, 247, 0.45)",
          cursor: "pointer",
        }}
      >
        <MessageSquarePlus size={15} aria-hidden="true" />
        <span>Open Chat Studio</span>
      </button>
    </div>
  );
};

