/**
//! Nano Route — Chat Session Navigation Sidebar
//! File: src/features/chat/components/ChatSessionSidebar.tsx
//!
//! Interactive conversation sidebar with "+ New Chat" action, title search filter,
//! pinned session prioritization, and deletion confirmation dialog.
*/

import React, { useState, useMemo } from "react";
import { Plus, Search, MessageSquareX } from "lucide-react";
import type { ChatSession } from "../types";
import { ChatSessionItem } from "./ChatSessionItem";
import { Skeleton } from "../../../components/ui/Skeleton";
import { ConfirmDialog } from "../../../components/overlays/ConfirmDialog";

export interface ChatSessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isLoading: boolean;
  onSelectSession: (sessionId: string) => void;
  onCreateSession: () => Promise<unknown> | void;
  onTogglePin: (sessionId: string, pinned: boolean) => Promise<unknown> | void;
  onDeleteSession: (sessionId: string) => Promise<unknown> | void;
  className?: string;
}

export const ChatSessionSidebar: React.FC<ChatSessionSidebarProps> = ({
  sessions,
  activeSessionId,
  isLoading,
  onSelectSession,
  onCreateSession,
  onTogglePin,
  onDeleteSession,
  className = "",
}) => {
  const [filterQuery, setFilterQuery] = useState("");
  const [pendingDeleteSession, setPendingDeleteSession] = useState<ChatSession | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter and sort sessions: pinned first, then by updatedAt descending
  const filteredSessions = useMemo(() => {
    const query = filterQuery.trim().toLowerCase();
    let result = sessions;
    if (query) {
      result = result.filter((s) => s.title.toLowerCase().includes(query));
    }
    return [...result].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });
  }, [sessions, filterQuery]);

  const handleConfirmDelete = async () => {
    if (!pendingDeleteSession) return;
    setIsDeleting(true);
    try {
      await onDeleteSession(pendingDeleteSession.id);
      setPendingDeleteSession(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <aside
        className={`nr-chat-session-sidebar ${className}`}
        style={{
          width: "280px",
          minWidth: "240px",
          maxWidth: "320px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--nr-bg-surface, #111318)",
          borderRight: "1px solid var(--nr-border-default, #27272a)",
          flexShrink: 0,
        }}
        aria-label="Conversation sessions sidebar"
      >
        {/* Top Action Bar */}
        <div style={{ padding: "0.875rem 0.75rem 0.5rem 0.75rem" }}>
          <button
            type="button"
            onClick={() => void onCreateSession()}
            aria-label="Start new conversation"
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "0.5rem 0.75rem",
              backgroundColor: "var(--nr-accent-purple, #7c3aed)",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--nr-radius-md, 6px)",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--nr-accent-purple-hover, #6d28d9)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--nr-accent-purple, #7c3aed)";
            }}
          >
            <Plus style={{ width: "16px", height: "16px" }} />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search / Filter Box */}
        <div style={{ padding: "0.25rem 0.75rem 0.5rem 0.75rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.3rem 0.5rem",
              backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
              border: "1px solid var(--nr-border-subtle, #1f222b)",
              borderRadius: "var(--nr-radius-sm, 4px)",
            }}
          >
            <Search style={{ width: "13px", height: "13px", color: "var(--nr-text-muted, #71717a)" }} />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search chats..."
              aria-label="Filter conversation sessions"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: "0.75rem",
                color: "var(--nr-text-primary, #ffffff)",
              }}
            />
          </div>
        </div>

        {/* Sessions Scroll List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "0.25rem 0",
          }}
          tabIndex={0}
          role="region"
          aria-label="Session list"
        >
          {isLoading && sessions.length === 0 ? (
            <div style={{ padding: "0.75rem 1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <Skeleton width="100%" height="38px" />
              <Skeleton width="100%" height="38px" />
              <Skeleton width="100%" height="38px" />
              <Skeleton width="100%" height="38px" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "2rem 1rem",
                textAlign: "center",
                color: "var(--nr-text-muted, #71717a)",
              }}
            >
              <MessageSquareX style={{ width: "24px", height: "24px", marginBottom: "0.5rem", opacity: 0.5 }} />
              <span style={{ fontSize: "0.8125rem" }}>
                {filterQuery ? "No matching conversations" : "No conversations yet"}
              </span>
            </div>
          ) : (
            filteredSessions.map((session) => (
              <ChatSessionItem
                key={session.id}
                session={session}
                isActive={session.id === activeSessionId}
                onSelect={onSelectSession}
                onTogglePin={(id, pinned) => void onTogglePin(id, pinned)}
                onDeleteRequest={(s) => setPendingDeleteSession(s)}
              />
            ))
          )}
        </div>
      </aside>

      {/* Confirmation Dialog for Session Deletion */}
      <ConfirmDialog
        isOpen={Boolean(pendingDeleteSession)}
        title="Delete Conversation"
        description={`Are you sure you want to delete "${pendingDeleteSession?.title}"? All messages in this conversation will be permanently removed.`}
        confirmLabel="Delete Conversation"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDeleteSession(null)}
      />
    </>
  );
};

