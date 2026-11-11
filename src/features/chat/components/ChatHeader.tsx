/**
//! Nano Route — Chat Studio Conversation Header
//! File: src/features/chat/components/ChatHeader.tsx
//!
//! Conversation workspace header providing session title display/inline renaming,
//! pin toggle, session deletion with confirmation dialog, and sidebar collapse control.
*/

import React, { useState, useRef, useEffect } from "react";
import { Check, Edit2, PanelLeft, Pin, Trash2, X } from "lucide-react";
import type { ChatSession } from "../types";
import { ConfirmDialog } from "../../../components/overlays/ConfirmDialog";

export interface ChatHeaderProps {
  session: ChatSession | null;
  onRename: (sessionId: string, newTitle: string) => Promise<unknown> | void;
  onTogglePin: (sessionId: string, pinned: boolean) => Promise<unknown> | void;
  onDelete: (sessionId: string) => Promise<unknown> | void;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  className?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  session,
  onRename,
  onTogglePin,
  onDelete,
  onToggleSidebar,
  isSidebarOpen = true,
  className = "",
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (session) {
      setTitleDraft(session.title);
    }
  }, [session]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (!session) {
    return (
      <header
        className={`nr-chat-header ${className}`}
        style={{
          display: "flex",
          alignItems: "center",
          height: "56px",
          padding: "0 1.25rem",
          borderBottom: "1px solid var(--nr-border-default, #27272a)",
          backgroundColor: "var(--nr-bg-surface, #111318)",
        }}
      >
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={isSidebarOpen ? "Collapse session sidebar" : "Expand session sidebar"}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--nr-text-secondary, #a1a1aa)",
              cursor: "pointer",
              padding: "0.4rem",
              borderRadius: "var(--nr-radius-sm, 4px)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <PanelLeft style={{ width: "18px", height: "18px" }} />
          </button>
        )}
        <span style={{ fontSize: "0.875rem", color: "var(--nr-text-muted, #71717a)", marginLeft: "0.5rem" }}>
          No active conversation
        </span>
      </header>
    );
  }

  const handleSaveRename = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === session.title) {
      setIsEditing(false);
      setTitleDraft(session.title);
      return;
    }

    try {
      await onRename(session.id, trimmed);
      setIsEditing(false);
    } catch {
      // Revert if error
      setTitleDraft(session.title);
      setIsEditing(false);
    }
  };

  const handleCancelRename = () => {
    setTitleDraft(session.title);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      void handleSaveRename();
    } else if (e.key === "Escape") {
      handleCancelRename();
    }
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(session.id);
      setIsDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <header
        className={`nr-chat-header ${className}`}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "56px",
          padding: "0 1.25rem",
          borderBottom: "1px solid var(--nr-border-default, #27272a)",
          backgroundColor: "var(--nr-bg-surface, #111318)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0 }}>
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              aria-label={isSidebarOpen ? "Collapse session sidebar" : "Expand session sidebar"}
              title="Toggle sidebar"
              style={{
                background: "transparent",
                border: "none",
                color: "var(--nr-text-secondary, #a1a1aa)",
                cursor: "pointer",
                padding: "0.4rem",
                borderRadius: "var(--nr-radius-sm, 4px)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <PanelLeft style={{ width: "18px", height: "18px" }} />
            </button>
          )}

          {isEditing ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flex: 1, maxWidth: "420px" }}>
              <input
                ref={inputRef}
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={255}
                aria-label="Edit conversation title"
                style={{
                  flex: 1,
                  backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
                  border: "1px solid var(--nr-border-focus, #7c3aed)",
                  borderRadius: "var(--nr-radius-sm, 4px)",
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.875rem",
                  color: "var(--nr-text-primary, #ffffff)",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => void handleSaveRename()}
                aria-label="Save title"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--nr-status-success, #10b981)",
                  cursor: "pointer",
                  padding: "0.25rem",
                }}
              >
                <Check style={{ width: "16px", height: "16px" }} />
              </button>
              <button
                type="button"
                onClick={handleCancelRename}
                aria-label="Cancel editing"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--nr-text-muted, #71717a)",
                  cursor: "pointer",
                  padding: "0.25rem",
                }}
              >
                <X style={{ width: "16px", height: "16px" }} />
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary, #ffffff)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={session.title}
              >
                {session.title}
              </h2>
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                aria-label="Rename conversation"
                title="Rename conversation"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--nr-text-muted, #71717a)",
                  cursor: "pointer",
                  padding: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  borderRadius: "var(--nr-radius-sm, 4px)",
                }}
              >
                <Edit2 style={{ width: "13px", height: "13px" }} />
              </button>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {/* Pin / Unpin Button */}
          <button
            type="button"
            onClick={() => void onTogglePin(session.id, !session.pinned)}
            aria-label={session.pinned ? "Unpin conversation" : "Pin conversation"}
            title={session.pinned ? "Unpin conversation" : "Pin conversation to top"}
            style={{
              background: session.pinned
                ? "var(--nr-accent-purple-subtle, rgba(124, 58, 237, 0.12))"
                : "transparent",
              border: session.pinned
                ? "1px solid var(--nr-accent-purple-border, rgba(124, 58, 237, 0.35))"
                : "1px solid transparent",
              color: session.pinned
                ? "var(--nr-accent-purple, #7c3aed)"
                : "var(--nr-text-muted, #71717a)",
              cursor: "pointer",
              padding: "0.35rem 0.6rem",
              borderRadius: "var(--nr-radius-sm, 4px)",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.75rem",
            }}
          >
            <Pin
              style={{
                width: "14px",
                height: "14px",
                fill: session.pinned ? "currentColor" : "none",
              }}
            />
            <span>{session.pinned ? "Pinned" : "Pin"}</span>
          </button>

          {/* Delete Session Button */}
          <button
            type="button"
            onClick={() => setIsDeleteDialogOpen(true)}
            aria-label="Delete conversation"
            title="Delete conversation"
            style={{
              background: "transparent",
              border: "1px solid transparent",
              color: "var(--nr-text-muted, #71717a)",
              cursor: "pointer",
              padding: "0.35rem 0.5rem",
              borderRadius: "var(--nr-radius-sm, 4px)",
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              fontSize: "0.75rem",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--nr-status-error, #ef4444)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--nr-text-muted, #71717a)";
            }}
          >
            <Trash2 style={{ width: "14px", height: "14px" }} />
          </button>
        </div>
      </header>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isDeleteDialogOpen}
        title="Delete Conversation"
        description={`Are you sure you want to delete "${session.title}"? This will permanently remove all messages in this conversation.`}
        confirmLabel="Delete Conversation"
        cancelLabel="Cancel"
        isDestructive={true}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </>
  );
};

