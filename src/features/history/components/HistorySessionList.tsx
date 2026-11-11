/**
//! Nano Route — History Explorer Bounded Session List & Search Results
//! File: src/features/history/components/HistorySessionList.tsx
//!
//! Renders bounded, keyboard-navigable conversation cards with match highlights,
//! bulk-selection checkboxes, pin/delete quick actions, and pagination controls.
*/

import React, { useRef } from "react";
import {
  FileText,
  Loader2,
  MessageSquare,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import type {
  HistoryPageInfo,
  HistorySearchResult,
  HistorySessionDto,
} from "../types";
import { formatHistoryTimestamp, formatFullHistoryTimestamp } from "../timestamp";
import { SafeHighlightedText } from "./SafeHighlightedText";

export interface HistorySessionListProps {
  isSearchMode: boolean;
  sessions: HistorySessionDto[];
  searchResults: HistorySearchResult[];
  activeSessionId: string | null;
  selectedSessionIds: Set<string>;
  pageInfo: HistoryPageInfo;
  isLoadingMore: boolean;
  onSelectSession: (sessionId: string, focusMessageId?: string | null) => void;
  onToggleBulkSelect: (sessionId: string) => void;
  onPinSession: (sessionId: string, pinned: boolean) => void | Promise<unknown>;
  onRequestDeleteSession: (session: HistorySessionDto) => void;
  onLoadMore: () => void | Promise<unknown>;
}

export const HistorySessionList: React.FC<HistorySessionListProps> = ({
  isSearchMode,
  sessions,
  searchResults,
  activeSessionId,
  selectedSessionIds,
  pageInfo,
  isLoadingMore,
  onSelectSession,
  onToggleBulkSelect,
  onPinSession,
  onRequestDeleteSession,
  onLoadMore,
}) => {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const rows: Array<{
    session: HistorySessionDto;
    searchResult?: HistorySearchResult;
  }> = isSearchMode
    ? searchResults.map((res) => ({ session: res.session, searchResult: res }))
    : sessions.map((session) => ({ session }));

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    sessionId: string,
    defaultFocusMsgId?: string | null
  ) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = itemRefs.current[index + 1];
      next?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      const prev = itemRefs.current[index - 1];
      prev?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectSession(sessionId, defaultFocusMsgId ?? null);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
      }}
    >
      <div
        role="list"
        aria-label="Conversation history results"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.55rem",
        }}
      >
        {rows.map(({ session, searchResult }, index) => {
          const isActive = activeSessionId === session.id;
          const isChecked = selectedSessionIds.has(session.id);
          const firstPreviewId = searchResult?.previews?.[0]?.messageId ?? null;

          return (
            <div
              key={session.id}
              role="listitem"
              style={{
                borderRadius: "10px",
                border: isActive
                  ? "1px solid var(--nr-accent-purple, #a855f7)"
                  : "1px solid var(--nr-border-default, #27272a)",
                backgroundColor: isActive
                  ? "rgba(168, 85, 247, 0.1)"
                  : "var(--nr-bg-surface, #111318)",
                padding: "0.75rem 0.85rem",
                transition: "border-color 0.15s ease, background-color 0.15s ease",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0.65rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => onToggleBulkSelect(session.id)}
                  aria-label={`Select conversation ${session.title} for bulk actions`}
                  style={{
                    marginTop: "0.22rem",
                    cursor: "pointer",
                    accentColor: "var(--nr-accent-purple, #a855f7)",
                    flexShrink: 0,
                  }}
                />

                <button
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  type="button"
                  onClick={() => onSelectSession(session.id, firstPreviewId)}
                  onKeyDown={(e) =>
                    handleKeyDown(e, index, session.id, firstPreviewId)
                  }
                  aria-current={isActive ? "true" : undefined}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    textAlign: "left",
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    color: "inherit",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.42rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        color: "var(--nr-text-primary, #f4f4f5)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {searchResult?.titleMatch ? (
                        <SafeHighlightedText
                          text={session.title}
                          matchStart={searchResult.titleMatchStart}
                          matchLength={searchResult.titleMatchLength}
                        />
                      ) : (
                        session.title
                      )}
                    </span>

                    <span
                      title={formatFullHistoryTimestamp(session.updatedAt)}
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--nr-text-muted, #71717a)",
                        flexShrink: 0,
                      }}
                    >
                      {formatHistoryTimestamp(session.updatedAt)}
                    </span>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      gap: "0.4rem",
                      fontSize: "0.72rem",
                      color: "var(--nr-text-secondary, #a1a1aa)",
                    }}
                  >
                    {session.pinned && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          padding: "0.1rem 0.45rem",
                          borderRadius: "9999px",
                          backgroundColor: "rgba(168, 85, 247, 0.16)",
                          color: "var(--nr-accent-purple, #a855f7)",
                          border: "1px solid rgba(168, 85, 247, 0.35)",
                        }}
                      >
                        <Pin size={10} aria-hidden="true" />
                        <span>Pinned</span>
                      </span>
                    )}

                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        padding: "0.1rem 0.45rem",
                        borderRadius: "9999px",
                        backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                        border: "1px solid var(--nr-border-subtle, #1f222b)",
                      }}
                    >
                      <MessageSquare size={10} aria-hidden="true" />
                      <span>
                        {session.messageCount}{" "}
                        {session.messageCount === 1 ? "msg" : "msgs"}
                      </span>
                    </span>

                    {session.providersUsed.map((provider) => (
                      <span
                        key={provider}
                        style={{
                          padding: "0.1rem 0.45rem",
                          borderRadius: "9999px",
                          backgroundColor: "rgba(56, 189, 248, 0.1)",
                          color: "var(--nr-accent-blue, #38bdf8)",
                          border: "1px solid rgba(56, 189, 248, 0.25)",
                        }}
                      >
                        {provider}
                      </span>
                    ))}

                    {searchResult?.titleMatch && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.22rem",
                          padding: "0.1rem 0.45rem",
                          borderRadius: "9999px",
                          backgroundColor: "rgba(34, 197, 94, 0.12)",
                          color: "#4ade80",
                          border: "1px solid rgba(34, 197, 94, 0.3)",
                        }}
                      >
                        <FileText size={10} aria-hidden="true" />
                        <span>Title match</span>
                      </span>
                    )}

                    {searchResult && searchResult.matchedMessageCount > 0 && (
                      <span
                        style={{
                          padding: "0.1rem 0.45rem",
                          borderRadius: "9999px",
                          backgroundColor: "rgba(168, 85, 247, 0.14)",
                          color: "#d8b4fe",
                          border: "1px solid rgba(168, 85, 247, 0.3)",
                        }}
                      >
                        {searchResult.matchedMessageCount}{" "}
                        {searchResult.matchedMessageCount === 1
                          ? "message match"
                          : "message matches"}
                      </span>
                    )}
                  </div>
                </button>

                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    flexShrink: 0,
                  }}
                >
                  <button
                    type="button"
                    aria-label={
                      session.pinned
                        ? `Unpin conversation ${session.title}`
                        : `Pin conversation ${session.title}`
                    }
                    title={session.pinned ? "Unpin" : "Pin"}
                    onClick={(e) => {
                      e.stopPropagation();
                      void onPinSession(session.id, !session.pinned);
                    }}
                    style={{
                      padding: "0.32rem",
                      borderRadius: "6px",
                      border: "1px solid transparent",
                      background: "transparent",
                      color: session.pinned
                        ? "var(--nr-accent-purple, #a855f7)"
                        : "var(--nr-text-muted, #71717a)",
                      cursor: "pointer",
                    }}
                  >
                    {session.pinned ? (
                      <PinOff size={14} aria-hidden="true" />
                    ) : (
                      <Pin size={14} aria-hidden="true" />
                    )}
                  </button>

                  <button
                    type="button"
                    aria-label={`Delete conversation ${session.title}`}
                    title="Delete conversation"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRequestDeleteSession(session);
                    }}
                    style={{
                      padding: "0.32rem",
                      borderRadius: "6px",
                      border: "1px solid transparent",
                      background: "transparent",
                      color: "var(--nr-text-muted, #71717a)",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {searchResult && searchResult.previews.length > 0 && (
                <div
                  style={{
                    marginTop: "0.55rem",
                    paddingLeft: "1.6rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                  }}
                >
                  {searchResult.previews.map((preview) => (
                    <button
                      key={preview.messageId}
                      type="button"
                      onClick={() => onSelectSession(session.id, preview.messageId)}
                      style={{
                        textAlign: "left",
                        padding: "0.42rem 0.6rem",
                        borderRadius: "7px",
                        border: "1px solid var(--nr-border-subtle, #1f222b)",
                        backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                        color: "var(--nr-text-secondary, #a1a1aa)",
                        fontSize: "0.78rem",
                        lineHeight: 1.45,
                        cursor: "pointer",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 600,
                          color: "var(--nr-text-primary, #f4f4f5)",
                          marginRight: "0.4rem",
                          textTransform: "capitalize",
                        }}
                      >
                        {preview.sender}:
                      </span>
                      <SafeHighlightedText
                        text={preview.previewText}
                        matchStart={preview.matchStartOffset}
                        matchLength={preview.matchLength}
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {rows.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.45rem 0.25rem",
            fontSize: "0.76rem",
            color: "var(--nr-text-muted, #71717a)",
          }}
        >
          <span>
            Showing {rows.length}
            {typeof pageInfo.totalCount === "number"
              ? ` of ${pageInfo.totalCount}${pageInfo.totalCountIsExact ? "" : "+"}`
              : ""}
          </span>

          {pageInfo.hasMore && (
            <button
              type="button"
              disabled={isLoadingMore}
              onClick={() => void onLoadMore()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.42rem 0.85rem",
                borderRadius: "8px",
                fontSize: "0.78rem",
                backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                color: "var(--nr-text-primary, #f4f4f5)",
                border: "1px solid var(--nr-border-default, #27272a)",
                cursor: isLoadingMore ? "wait" : "pointer",
              }}
            >
              {isLoadingMore && (
                <Loader2
                  size={13}
                  style={{ animation: "spin 1s linear infinite" }}
                  aria-hidden="true"
                />
              )}
              <span>{isLoadingMore ? "Loading..." : "Load more"}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
