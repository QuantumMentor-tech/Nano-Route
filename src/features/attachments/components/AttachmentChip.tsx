/**
 * Nano Route — Composer Attachment Chip & Preview Component
 * File: src/features/attachments/components/AttachmentChip.tsx
 *
 * Implements Step 79:
 * - Compact visual representation for selected attachments.
 * - Displays filename, size, category icon, and error/status indicators.
 * - Accessible remove button.
 */

import React from "react";
import type { LocalAttachment } from "../types.ts";
import { FileText, Code, FileSpreadsheet, Image, AlertCircle, X, Loader2 } from "lucide-react";

export interface AttachmentChipProps {
  attachment: LocalAttachment;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

export const AttachmentChip: React.FC<AttachmentChipProps> = ({
  attachment,
  onRemove,
  disabled = false,
}) => {
  const { id, metadata, status, errorMessage } = attachment;

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryIcon = () => {
    switch (metadata.category) {
      case "image":
        return <Image style={{ width: "12px", height: "12px", color: "var(--nr-accent-cyan, #06b6d4)" }} />;
      case "code":
        return <Code style={{ width: "12px", height: "12px", color: "var(--nr-accent-purple, #a855f7)" }} />;
      case "structured":
        return <FileSpreadsheet style={{ width: "12px", height: "12px", color: "var(--nr-status-warning, #f59e0b)" }} />;
      default:
        return <FileText style={{ width: "12px", height: "12px", color: "var(--nr-text-secondary, #a1a1aa)" }} />;
    }
  };

  const isError = ["UNSUPPORTED", "TOO_LARGE", "UNREADABLE", "ERROR"].includes(status);
  const isPreparing = status === "PREPARING" || status === "VALIDATING";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        padding: "0.2rem 0.5rem",
        backgroundColor: isError
          ? "rgba(239, 68, 68, 0.12)"
          : "var(--nr-bg-surface-elevated, #181b22)",
        border: `1px solid ${
          isError ? "var(--nr-status-error, #ef4444)" : "var(--nr-border-default, #27272a)"
        }`,
        borderRadius: "var(--nr-radius-sm, 4px)",
        fontSize: "0.75rem",
        color: isError ? "var(--nr-status-error, #ef4444)" : "var(--nr-text-primary, #ffffff)",
        userSelect: "none",
        maxWidth: "240px",
      }}
      title={isError ? errorMessage : `${metadata.name} (${formatSize(metadata.sizeBytes)})`}
    >
      {isPreparing ? (
        <Loader2 className="nr-spin" style={{ width: "12px", height: "12px" }} />
      ) : isError ? (
        <AlertCircle style={{ width: "12px", height: "12px" }} />
      ) : (
        getCategoryIcon()
      )}

      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          maxWidth: "140px",
        }}
      >
        {metadata.name}
      </span>

      <span style={{ fontSize: "0.65rem", color: "var(--nr-text-muted, #71717a)" }}>
        ({formatSize(metadata.sizeBytes)})
      </span>

      {!disabled && (
        <button
          type="button"
          onClick={() => onRemove(id)}
          aria-label={`Remove attachment ${metadata.name}`}
          style={{
            background: "none",
            border: "none",
            padding: "0.1rem",
            color: "var(--nr-text-muted, #71717a)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X style={{ width: "11px", height: "11px" }} />
        </button>
      )}
    </div>
  );
};

