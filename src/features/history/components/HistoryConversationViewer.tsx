/**
//! Nano Route — Passive History Conversation Inspector
//! File: src/features/history/components/HistoryConversationViewer.tsx
//!
//! Displays a selected historical conversation read-only without triggering
//! local SLM analysis, routing scoring, health checks, or provider requests.
//! Supports inline rename, pin/unpin, single-message delete, full-session delete,
//! focus scrolling to search hits, and explicit "Continue in Chat Studio" handoff.
*/

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  Check,
  Edit3,
  History,
  Loader2,
  Pin,
  PinOff,
  Trash2,
  X,
} from "lucide-react";
import type { ChatSession, HistoryMessage, HistorySessionDto } from "../types";
import { formatFullHistoryTimestamp } from "../timestamp";
import { UserMessage } from "../../chat/components/UserMessage";
import { AssistantMessage } from "../../chat/components/AssistantMessage";
import { SystemMessage } from "../../chat/components/SystemMessage";
import { ConfirmDialog } from "../../../components/overlays/ConfirmDialog";

export type InspectableHistorySession =
  | HistorySessionDto
  | (ChatSession &
      Partial<Pick<HistorySessionDto, "messageCount" | "providersUsed" | "modelsUsed">>);

export interface HistoryConversationViewerProps {
  session: InspectableHistorySession | null;
  messages: HistoryMessage[];
  focusMessageId: string | null;
  isLoading: boolean;
  error: string | null;
  onPinSession: (sessionId: string, pinned: boolean) => void | Promise<unknown>;
  onRenameSession: (sessionId: string, newTitle: string) => Promise<unknown>;
  onDeleteMessage: (messageId: string, sessionId: string) => Promise<unknown>;
  onRequestDeleteSession: (session: HistorySessionDto) => void;
  onContinueInChat: (sessionId: string, focusMessageId?: string | null) => void;
  onRetryLoad?: () => void;
}

export const HistoryConversationViewer: React.FC<
  HistoryConversationViewerProps
> = ({
  session,
  messages,
  focusMessageId,
  isLoading,
  error,
  onPinSession,
  onRenameSession,
  onDeleteMessage,
  onRequestDeleteSession,
  onContinueInChat,
  onRetryLoad,
}) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isSavingRename, setIsSavingRename] = useState(false);

  const [pendingDeleteMessage, setPendingDeleteMessage] =
    useState<HistoryMessage | null>(null);
  const [isDeletingMessage, setIsDeletingMessage] = useState(false);

  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    setIsRenaming(false);
    setRenameError(null);
    setDraftTitle(session?.title ?? "");
  }, [session?.id, session?.title]);

  useEffect(() => {
    if (!focusMessageId || messages.length === 0) return;
    const targetEl = messageRefs.current[focusMessageId];
    if (targetEl && typeof targetEl.scrollIntoView === "function") {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setHighlightedId(focusMessageId);
    const timer = window.setTimeout(() => {
      setHighlightedId((prev) => (prev === focusMessageId ? null : prev));
    }, 3200);
    return () => window.clearTimeout(timer);
  }, [focusMessageId, messages]);

  const handleStartRename = () => {
    if (!session) return;
    setDraftTitle(session.title);
    setRenameError(null);
    setIsRenaming(true);
  };

  const handleSaveRename = async () => {
    if (!session) return;
    const trimmed = draftTitle.trim();
    if (!trimmed) {
      setRenameError("Conversation title cannot be empty.");
      return;
    }
    setIsSavingRename(true);
    setRenameError(null);
    try {
      await onRenameSession(session.id, trimmed);
      setIsRenaming(false);
    } catch (err) {
      setRenameError(
        err instanceof Error ? err.message : "Failed to rename conversation."
      );
    } finally {
      setIsSavingRename(false);
    }
  };

  const handleConfirmDeleteMessage = async () => {
    if (!pendingDeleteMessage || !session) return;
    setIsDeletingMessage(true);
    try {
      await onDeleteMessage(pendingDeleteMessage.id, session.id);
      setPendingDeleteMessage(null);
    } finally {
      setIsDeletingMessage(false);
    }
  };

  if (!session) {
    return (
      <section
        aria-label="Conversation inspector"
        style={{
          borderRadius: "12px",
          border: "1px solid var(--nr-border-default, #27272a)",
          backgroundColor: "var(--nr-bg-surface, #111318)",
          padding: "2.5rem 1.5rem",
          minHeight: "420px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: "0.75rem",
        }}
      >
        <History
          size={30}
          style={{ color: "var(--nr-text-muted, #71717a)" }}
          aria-hidden="true"
        />
        <h3
          style={{
            margin: 0,
            fontSize: "0.98rem",
            color: "var(--nr-text-primary, #f4f4f5)",
          }}
        >
          Select a conversation to inspect
        </h3>
        <p
          style={{
            margin: 0,
            maxWidth: "360px",
            fontSize: "0.82rem",
            color: "var(--nr-text-secondary, #a1a1aa)",
            lineHeight: 1.5,
          }}
        >
          Inspect full message timelines, recorded routing snapshots, and timestamps offline — without running the local SLM or making network calls.
        </p>
      </section>
    );
  }

  const providersUsed =
    session.providersUsed ??
    Array.from(
      new Set(
        messages
          .map((m) => m.metadata?.routedProvider)
          .filter((v): v is string => Boolean(v && v.trim()))
      )
    );

  const modelsUsed =
    session.modelsUsed ??
    Array.from(
      new Set(
        messages
          .map((m) => m.metadata?.routedModel)
          .filter((v): v is string => Boolean(v && v.trim()))
      )
    );

  const normalizedSessionDto: HistorySessionDto = {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    pinned: session.pinned,
    messageCount: session.messageCount ?? messages.length,
    providersUsed,
    modelsUsed,
  };

  return (
    <section
      aria-label={`Inspecting conversation ${session.title}`}
      style={{
        borderRadius: "12px",
        border: "1px solid var(--nr-border-default, #27272a)",
        backgroundColor: "var(--nr-bg-surface, #111318)",
        display: "flex",
        flexDirection: "column",
        minHeight: "480px",
        maxHeight: "76vh",
        overflow: "hidden",
      }}
    >
      {/* Inspector Header */}
      <header
        style={{
          padding: "0.9rem 1.1rem",
          borderBottom: "1px solid var(--nr-border-default, #27272a)",
          backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
          display: "flex",
          flexDirection: "column",
          gap: "0.65rem",
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
          {isRenaming ? (
            <div
              style={{
                flex: "1 1 260px",
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
              }}
            >
              <input
                type="text"
                aria-label="New conversation title"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSaveRename();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setIsRenaming(false);
                    setRenameError(null);
                  }
                }}
                autoFocus
                style={{
                  flex: 1,
                  minWidth: "160px",
                  padding: "0.38rem 0.6rem",
                  borderRadius: "7px",
                  border: "1px solid var(--nr-accent-purple, #a855f7)",
                  backgroundColor: "var(--nr-bg-app, #09090b)",
                  color: "var(--nr-text-primary, #f4f4f5)",
                  fontSize: "0.9rem",
                }}
              />
              <button
                type="button"
                aria-label="Save conversation title"
                disabled={isSavingRename}
                onClick={() => void handleSaveRename()}
                style={{
                  padding: "0.38rem 0.6rem",
                  borderRadius: "7px",
                  border: "1px solid rgba(34, 197, 94, 0.4)",
                  backgroundColor: "rgba(34, 197, 94, 0.14)",
                  color: "#4ade80",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <Check size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Cancel rename"
                onClick={() => {
                  setIsRenaming(false);
                  setRenameError(null);
                }}
                style={{
                  padding: "0.38rem 0.6rem",
                  borderRadius: "7px",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  backgroundColor: "transparent",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div
              style={{
                flex: "1 1 220px",
                minWidth: 0,
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: "1.02rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary, #f4f4f5)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {session.title}
              </h2>
              <button
                type="button"
                aria-label="Rename conversation"
                title="Rename conversation"
                onClick={handleStartRename}
                style={{
                  padding: "0.28rem",
                  borderRadius: "6px",
                  border: "1px solid transparent",
                  background: "transparent",
                  color: "var(--nr-text-muted, #71717a)",
                  cursor: "pointer",
                }}
              >
                <Edit3 size={14} aria-hidden="true" />
              </button>
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            <button
              type="button"
              onClick={() => void onPinSession(session.id, !session.pinned)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.4rem 0.7rem",
                borderRadius: "8px",
                fontSize: "0.78rem",
                border: "1px solid var(--nr-border-default, #27272a)",
                backgroundColor: "var(--nr-bg-surface, #111318)",
                color: session.pinned
                  ? "var(--nr-accent-purple, #a855f7)"
                  : "var(--nr-text-secondary, #a1a1aa)",
                cursor: "pointer",
              }}
            >
              {session.pinned ? (
                <PinOff size={13} aria-hidden="true" />
              ) : (
                <Pin size={13} aria-hidden="true" />
              )}
              <span>{session.pinned ? "Unpin" : "Pin"}</span>
            </button>

            <button
              type="button"
              onClick={() => onContinueInChat(session.id, focusMessageId)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.4rem 0.8rem",
                borderRadius: "8px",
                fontSize: "0.78rem",
                fontWeight: 500,
                border: "1px solid rgba(168, 85, 247, 0.45)",
                backgroundColor: "rgba(168, 85, 247, 0.16)",
                color: "var(--nr-text-primary, #f4f4f5)",
                cursor: "pointer",
              }}
            >
              <span>Continue in Chat Studio</span>
              <ArrowUpRight size={13} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => onRequestDeleteSession(normalizedSessionDto)}
              aria-label="Delete conversation"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.32rem",
                padding: "0.4rem 0.7rem",
                borderRadius: "8px",
                fontSize: "0.78rem",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                color: "#fca5a5",
                cursor: "pointer",
              }}
            >
              <Trash2 size={13} aria-hidden="true" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {renameError && (
          <div role="alert" style={{ fontSize: "0.76rem", color: "#f87171" }}>
            {renameError}
          </div>
        )}

        {/* Passive Historical Metadata Strip */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "0.65rem",
            fontSize: "0.74rem",
            color: "var(--nr-text-muted, #71717a)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
          >
            <Calendar size={12} aria-hidden="true" />
            <span>Created {formatFullHistoryTimestamp(session.createdAt)}</span>
          </span>
          <span>·</span>
          <span>Updated {formatFullHistoryTimestamp(session.updatedAt)}</span>
          <span>·</span>
          <span>
            Providers:{" "}
            {providersUsed.length > 0
              ? providersUsed.join(", ")
              : "Not recorded"}
          </span>
          <span>·</span>
          <span>
            Models:{" "}
            {modelsUsed.length > 0
              ? modelsUsed.join(", ")
              : "Not recorded"}
          </span>
          <span
            style={{
              marginLeft: "auto",
              padding: "0.12rem 0.5rem",
              borderRadius: "9999px",
              border: "1px solid var(--nr-border-subtle, #1f222b)",
              backgroundColor: "var(--nr-bg-surface, #111318)",
              color: "var(--nr-text-secondary, #a1a1aa)",
            }}
          >
            Read-only historical record
          </span>
        </div>
      </header>

      {/* Passive Message Timeline */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "1rem 1.1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.45rem",
        }}
      >
        {isLoading ? (
          <div
            role="status"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.55rem",
              padding: "2.5rem 1rem",
              color: "var(--nr-text-secondary, #a1a1aa)",
              fontSize: "0.85rem",
            }}
          >
            <Loader2
              size={16}
              style={{ animation: "spin 1s linear infinite" }}
              aria-hidden="true"
            />
            <span>Loading historical messages...</span>
          </div>
        ) : error ? (
          <div
            role="alert"
            style={{
              padding: "1.25rem",
              borderRadius: "10px",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              backgroundColor: "rgba(239, 68, 68, 0.08)",
              color: "#fca5a5",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.84rem" }}>
              <AlertCircle size={16} aria-hidden="true" />
              <span>{error}</span>
            </span>
            {onRetryLoad && (
              <button
                type="button"
                onClick={onRetryLoad}
                style={{
                  padding: "0.35rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid rgba(252, 165, 165, 0.4)",
                  backgroundColor: "transparent",
                  color: "#fca5a5",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                }}
              >
                Retry
              </button>
            )}
          </div>
        ) : messages.length === 0 ? (
          <div
            style={{
              padding: "2.25rem 1rem",
              textAlign: "center",
              color: "var(--nr-text-muted, #71717a)",
              fontSize: "0.84rem",
            }}
          >
            No messages remain in this conversation.
          </div>
        ) : (
          messages.map((message) => {
            const isHighlighted = highlightedId === message.id;
            return (
              <div
                key={message.id}
                data-history-message-id={message.id}
                ref={(el) => {
                  messageRefs.current[message.id] = el;
                }}
                style={{
                  position: "relative",
                  borderRadius: "10px",
                  padding: "0.2rem 0.4rem",
                  border: isHighlighted
                    ? "1px solid var(--nr-accent-purple, #a855f7)"
                    : "1px solid transparent",
                  backgroundColor: isHighlighted
                    ? "rgba(168, 85, 247, 0.08)"
                    : "transparent",
                  transition: "border-color 0.25s ease, background-color 0.25s ease",
                }}
              >
                {message.sender === "user" && <UserMessage message={message} />}
                {message.sender === "assistant" && (
                  <AssistantMessage message={message} />
                )}
                {message.sender === "system" && (
                  <SystemMessage message={message} />
                )}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "flex-end",
                    marginTop: "-0.3rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  <button
                    type="button"
                    aria-label={`Delete message from ${message.sender}`}
                    onClick={() => setPendingDeleteMessage(message)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      padding: "0.18rem 0.48rem",
                      borderRadius: "6px",
                      border: "1px solid transparent",
                      background: "transparent",
                      color: "var(--nr-text-muted, #71717a)",
                      fontSize: "0.7rem",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={11} aria-hidden="true" />
                    <span>Delete message</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteMessage)}
        title="Delete message permanently?"
        description="This removes only the selected message from local conversation storage and updates search indexing. Other messages in this conversation remain intact."
        confirmLabel="Delete message"
        cancelLabel="Cancel"
        isDestructive
        isLoading={isDeletingMessage}
        onCancel={() => {
          if (!isDeletingMessage) setPendingDeleteMessage(null);
        }}
        onConfirm={handleConfirmDeleteMessage}
      />
    </section>
  );
};
