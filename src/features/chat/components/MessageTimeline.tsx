/**
//! Nano Route — Message Timeline Container
//! File: src/features/chat/components/MessageTimeline.tsx
//!
//! Scrollable message stream container with intelligent auto-scroll anchoring,
//! manual scroll detection, and floating "Jump to latest" control.
*/

import React, { useRef, useEffect, useState, useCallback } from "react";
import { ArrowDown } from "lucide-react";
import type { ChatMessage } from "../types";
import { MessageItem } from "./MessageItem";

export interface MessageTimelineProps {
  messages: ChatMessage[];
  emptyState?: React.ReactNode;
  focusMessageId?: string | null;
  className?: string;
}

export const MessageTimeline: React.FC<MessageTimelineProps> = ({
  messages,
  emptyState,
  focusMessageId = null,
  className = "",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const userScrolledUpRef = useRef(false);

  // Check scroll position to determine whether to show "Jump to latest" button
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isScrolledUp = distanceFromBottom > 150;
    userScrolledUpRef.current = isScrolledUp;
    setShowScrollBottomButton(isScrolledUp);
  }, []);

  // Scroll to bottom smoothly or instantly
  const scrollToBottom = useCallback((smooth = true) => {
    if (bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({
        behavior: smooth ? "smooth" : "auto",
      });
      userScrolledUpRef.current = false;
      setShowScrollBottomButton(false);
    }
  }, []);

  // Auto-scroll on new messages unless user scrolled up or focusing a specific historical match
  useEffect(() => {
    if (focusMessageId) {
      const container = containerRef.current;
      const target = container
        ? (Array.from(container.children).find(
            (el) => el.getAttribute("data-message-id") === focusMessageId
          ) as HTMLElement | undefined)
        : undefined;
      if (target && typeof target.scrollIntoView === "function") {
        userScrolledUpRef.current = true;
        target.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedMessageId(focusMessageId);
        const timer = setTimeout(() => setHighlightedMessageId(null), 2600);
        return () => clearTimeout(timer);
      }
    }

    if (!userScrolledUpRef.current) {
      scrollToBottom(false);
    }
  }, [messages, focusMessageId, scrollToBottom]);

  if (messages.length === 0 && emptyState) {
    return (
      <div
        className={`nr-message-timeline-empty ${className}`}
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          overflowY: "auto",
        }}
      >
        {emptyState}
      </div>
    );
  }

  return (
    <div
      style={{
        position: "relative",
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className={`nr-message-timeline ${className}`}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "1rem 1.5rem",
          display: "flex",
          flexDirection: "column",
          scrollBehavior: "smooth",
        }}
        tabIndex={0}
        role="log"
        aria-label="Conversation message history"
        aria-live="polite"
      >
        {messages.map((message) => (
          <div
            key={message.id}
            data-message-id={message.id}
            style={
              highlightedMessageId === message.id
                ? {
                    borderRadius: "var(--nr-radius-lg, 8px)",
                    outline: "2px solid var(--nr-accent-purple, #7c3aed)",
                    outlineOffset: "4px",
                    transition: "outline-color 0.25s ease",
                  }
                : undefined
            }
          >
            <MessageItem message={message} />
          </div>
        ))}
        <div ref={bottomAnchorRef} style={{ height: "1px", width: "100%" }} />
      </div>

      {/* Floating Jump to Latest Button */}
      {showScrollBottomButton && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          aria-label="Jump to latest message"
          style={{
            position: "absolute",
            bottom: "1rem",
            right: "2rem",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.4rem 0.8rem",
            backgroundColor: "var(--nr-bg-surface-elevated, #181b22)",
            color: "var(--nr-text-primary, #ffffff)",
            border: "1px solid var(--nr-border-default, #27272a)",
            borderRadius: "var(--nr-radius-full, 9999px)",
            boxShadow: "0 4px 12px rgba(0, 0, 0, 0.35)",
            cursor: "pointer",
            fontSize: "0.75rem",
            fontWeight: 500,
            zIndex: 10,
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--nr-bg-surface-hover, #1f232e)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--nr-bg-surface-elevated, #181b22)";
          }}
        >
          <ArrowDown style={{ width: "13px", height: "13px" }} />
          <span>Jump to latest</span>
        </button>
      )}
    </div>
  );
};

