/**
//! Nano Route — History Explorer Workspace Coordinator
//! File: src/features/history/components/HistoryExplorer.tsx
//!
//! Main History Explorer view coordinating debounced local search, structured
//! filtering, bounded pagination, bulk/single delete confirmations, and passive
//! conversation inspection with explicit "Continue in Chat Studio" handoff.
*/

import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CheckSquare,
  History,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { ROUTE_PATHS } from "../../../routes/routePaths";
import { ConfirmDialog } from "../../../components/overlays/ConfirmDialog";
import type { HistorySessionDto } from "../types";
import { useHistoryExplorer } from "../useHistoryExplorer";
import { HistoryFilterBar } from "./HistoryFilterBar";
import { HistoryEmptyState } from "./HistoryEmptyState";
import { HistorySessionList } from "./HistorySessionList";
import { HistoryConversationViewer } from "./HistoryConversationViewer";

export const HistoryExplorer: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const explorer = useHistoryExplorer({
    initialProviderFilter: searchParams.get("provider") ?? "",
    initialModelFilter: searchParams.get("model") ?? "",
  });

  const [pendingSingleDelete, setPendingSingleDelete] =
    useState<HistorySessionDto | null>(null);
  const [isDeletingSingle, setIsDeletingSingle] = useState(false);

  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const handleOpenChatStudio = () => {
    navigate(ROUTE_PATHS.CHAT);
  };

  const handleContinueInChat = (
    sessionId: string,
    focusMessageId?: string | null
  ) => {
    const params = new URLSearchParams();
    params.set("sessionId", sessionId);
    if (focusMessageId) {
      params.set("focusMessageId", focusMessageId);
    }
    navigate(`${ROUTE_PATHS.CHAT}?${params.toString()}`);
  };

  const handleConfirmSingleDelete = async () => {
    if (!pendingSingleDelete) return;
    setIsDeletingSingle(true);
    try {
      await explorer.deleteSingleSession(pendingSingleDelete.id);
      setPendingSingleDelete(null);
    } finally {
      setIsDeletingSingle(false);
    }
  };

  const handleConfirmBulkDelete = async () => {
    setIsDeletingBulk(true);
    try {
      await explorer.deleteSelectedBulk();
      setShowBulkConfirm(false);
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const bulkCount = explorer.selectedSessionIds.size;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
        width: "100%",
        maxWidth: "1360px",
        margin: "0 auto",
      }}
    >
      {/* Top Page Title & Action Row */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "rgba(168, 85, 247, 0.14)",
              border: "1px solid rgba(168, 85, 247, 0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--nr-accent-purple, #a855f7)",
              flexShrink: 0,
            }}
          >
            <History size={18} aria-hidden="true" />
          </div>
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: "1.2rem",
                fontWeight: 600,
                color: "var(--nr-text-primary, #f4f4f5)",
              }}
            >
              History Explorer
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "0.78rem",
                color: "var(--nr-text-secondary, #a1a1aa)",
              }}
            >
              Local indexed search and passive inspection of saved conversations
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void explorer.refreshHistory()}
          aria-label="Refresh conversation history"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.42rem 0.78rem",
            borderRadius: "8px",
            border: "1px solid var(--nr-border-default, #27272a)",
            backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
            color: "var(--nr-text-secondary, #a1a1aa)",
            fontSize: "0.78rem",
            cursor: "pointer",
          }}
        >
          <RefreshCw size={13} aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search & Filters */}
      <HistoryFilterBar
        searchInput={explorer.searchInput}
        onSearchChange={explorer.setSearchInput}
        onClearSearch={explorer.clearSearch}
        sortMode={explorer.sortMode}
        onSortChange={explorer.setSortMode}
        providerFilter={explorer.providerFilter}
        onProviderChange={explorer.setProviderFilter}
        modelFilter={explorer.modelFilter}
        onModelChange={explorer.setModelFilter}
        pinnedOnly={explorer.pinnedOnly}
        onPinnedOnlyChange={explorer.setPinnedOnly}
        datePreset={explorer.datePreset}
        onDatePresetChange={explorer.setDatePreset}
        customDateFrom={explorer.customDateFrom}
        onCustomDateFromChange={explorer.setCustomDateFrom}
        customDateTo={explorer.customDateTo}
        onCustomDateToChange={explorer.setCustomDateTo}
        filterOptions={explorer.filterOptions}
        hasActiveFilters={explorer.hasActiveFilters}
        onResetFilters={explorer.resetFilters}
        isSearchMode={explorer.isSearchMode}
        isSearching={explorer.viewStatus === "searching"}
        searchEngineUsed={explorer.searchEngineUsed}
        searchDurationMs={explorer.searchDurationMs}
      />

      {/* Recoverable Error Banner */}
      {explorer.error && (
        <div
          role="alert"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "0.75rem 1rem",
            borderRadius: "10px",
            border: "1px solid rgba(239, 68, 68, 0.35)",
            backgroundColor: "rgba(239, 68, 68, 0.08)",
            color: "#fca5a5",
            fontSize: "0.82rem",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{explorer.error.message}</span>
          </span>
          <div style={{ display: "inline-flex", gap: "0.5rem" }}>
            {explorer.error.retryAction && (
              <button
                type="button"
                onClick={() => void explorer.error?.retryAction?.()}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid rgba(252, 165, 165, 0.4)",
                  backgroundColor: "transparent",
                  color: "#fca5a5",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
              >
                {explorer.error.operation === "search" ? "Retry search" : "Retry"}
              </button>
            )}
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={explorer.clearError}
              style={{
                padding: "0.3rem",
                borderRadius: "6px",
                border: "none",
                background: "transparent",
                color: "#fca5a5",
                cursor: "pointer",
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Controlled Bulk Selection Action Bar */}
      {bulkCount > 0 && (
        <div
          role="region"
          aria-label="Bulk selection actions"
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "0.65rem 0.95rem",
            borderRadius: "10px",
            border: "1px solid rgba(168, 85, 247, 0.45)",
            backgroundColor: "rgba(168, 85, 247, 0.12)",
          }}
        >
          <span
            style={{
              fontSize: "0.84rem",
              fontWeight: 500,
              color: "var(--nr-text-primary, #f4f4f5)",
            }}
          >
            {bulkCount}{" "}
            {bulkCount === 1 ? "conversation selected" : "conversations selected"}
          </span>

          <div style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={explorer.selectAllVisible}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.38rem 0.7rem",
                borderRadius: "7px",
                border: "1px solid var(--nr-border-default, #27272a)",
                backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                color: "var(--nr-text-primary, #f4f4f5)",
                fontSize: "0.78rem",
                cursor: "pointer",
              }}
            >
              <CheckSquare size={13} aria-hidden="true" />
              <span>Select all visible</span>
            </button>

            <button
              type="button"
              onClick={explorer.clearBulkSelection}
              style={{
                padding: "0.38rem 0.7rem",
                borderRadius: "7px",
                border: "1px solid var(--nr-border-default, #27272a)",
                backgroundColor: "transparent",
                color: "var(--nr-text-secondary, #a1a1aa)",
                fontSize: "0.78rem",
                cursor: "pointer",
              }}
            >
              Clear selection
            </button>

            <button
              type="button"
              onClick={() => setShowBulkConfirm(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.38rem 0.78rem",
                borderRadius: "7px",
                border: "1px solid rgba(239, 68, 68, 0.45)",
                backgroundColor: "rgba(239, 68, 68, 0.16)",
                color: "#fca5a5",
                fontSize: "0.78rem",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              <Trash2 size={13} aria-hidden="true" />
              <span>
                Delete {bulkCount}{" "}
                {bulkCount === 1 ? "conversation" : "conversations"}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Split Workspace: Bounded Results List + Passive Conversation Inspector */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(300px, 430px) minmax(0, 1fr)",
          gap: "1rem",
          alignItems: "start",
        }}
      >
        {/* Left Pane: Results / Skeletons / Empty State */}
        <div style={{ minWidth: 0 }}>
          {explorer.viewStatus === "loading" || explorer.viewStatus === "searching" ? (
            <div
              role="status"
              aria-label="Loading conversation history"
              style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}
            >
              {[0, 1, 2, 3].map((slot) => (
                <div
                  key={slot}
                  style={{
                    height: "76px",
                    borderRadius: "10px",
                    border: "1px solid var(--nr-border-default, #27272a)",
                    backgroundColor: "var(--nr-bg-surface, #111318)",
                    opacity: 0.7 - slot * 0.12,
                  }}
                />
              ))}
            </div>
          ) : explorer.viewStatus === "empty" ? (
            <HistoryEmptyState
              isSearchMode={explorer.isSearchMode}
              searchQuery={explorer.debouncedQuery}
              hasActiveFilters={explorer.hasActiveFilters}
              onClearSearch={explorer.clearSearch}
              onResetFilters={explorer.resetFilters}
              onOpenChatStudio={handleOpenChatStudio}
            />
          ) : (
            <HistorySessionList
              isSearchMode={explorer.isSearchMode}
              sessions={explorer.sessions}
              searchResults={explorer.searchResults}
              activeSessionId={explorer.activeSessionId}
              selectedSessionIds={explorer.selectedSessionIds}
              pageInfo={explorer.pageInfo}
              isLoadingMore={explorer.isLoadingMore}
              onSelectSession={explorer.selectConversation}
              onToggleBulkSelect={explorer.toggleBulkSelection}
              onPinSession={explorer.pinSession}
              onRequestDeleteSession={(session) => setPendingSingleDelete(session)}
              onLoadMore={explorer.loadNextPage}
            />
          )}
        </div>

        {/* Right Pane: Passive Conversation Viewer */}
        <div style={{ minWidth: 0 }}>
          <HistoryConversationViewer
            session={explorer.activeSession}
            messages={explorer.activeMessages}
            focusMessageId={explorer.focusMessageId}
            isLoading={explorer.isLoadingConversation}
            error={explorer.conversationError}
            onPinSession={explorer.pinSession}
            onRenameSession={explorer.renameSession}
            onDeleteMessage={explorer.deleteSingleMessage}
            onRequestDeleteSession={(session) => setPendingSingleDelete(session)}
            onContinueInChat={handleContinueInChat}
            onRetryLoad={
              explorer.activeSessionId
                ? () =>
                    void explorer.selectConversation(
                      explorer.activeSessionId!,
                      explorer.focusMessageId
                    )
                : undefined
            }
          />
        </div>
      </div>

      {/* Single Session Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(pendingSingleDelete)}
        title="Delete conversation permanently?"
        description={
          pendingSingleDelete
            ? `Permanently delete "${pendingSingleDelete.title}" and all ${pendingSingleDelete.messageCount} ${
                pendingSingleDelete.messageCount === 1 ? "message" : "messages"
              } from local storage? This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete conversation"
        cancelLabel="Cancel"
        isDestructive
        isLoading={isDeletingSingle}
        onCancel={() => {
          if (!isDeletingSingle) setPendingSingleDelete(null);
        }}
        onConfirm={handleConfirmSingleDelete}
      />

      {/* Bulk Delete Confirmation */}
      <ConfirmDialog
        isOpen={showBulkConfirm}
        title={`Delete ${bulkCount} ${
          bulkCount === 1 ? "conversation" : "conversations"
        }?`}
        description={`This permanently removes ${bulkCount} selected ${
          bulkCount === 1 ? "conversation" : "conversations"
        } and their messages from local SQLite storage and FTS search index.`}
        confirmLabel={`Delete ${bulkCount} ${
          bulkCount === 1 ? "conversation" : "conversations"
        }`}
        cancelLabel="Cancel"
        isDestructive
        isLoading={isDeletingBulk}
        onCancel={() => {
          if (!isDeletingBulk) setShowBulkConfirm(false);
        }}
        onConfirm={handleConfirmBulkDelete}
      />
    </div>
  );
};

