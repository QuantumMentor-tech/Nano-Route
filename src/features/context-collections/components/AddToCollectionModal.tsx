/**
 * Nano Route — Add To Context Collection Modal Component
 * File: src/features/context-collections/components/AddToCollectionModal.tsx
 *
 * Implements Step 83:
 * - Direct action modal from chat messages, excerpts, notes, or attachments
 * - Lets user pick an existing collection or create a new one on the fly
 * - Displays explicit privacy warning when adding private notes
 */

import React, { useState, useEffect } from "react";
import { X, Plus, Layers, AlertTriangle, Check } from "lucide-react";
import {
  listCollections,
  createCollection,
  addItemToCollection,
} from "../engine.ts";
import {
  type ContextCollection,
  type ContextSourceType,
} from "../types.ts";

export interface AddToCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceType: ContextSourceType;
  sourceId: string;
  sessionId?: string | null;
  branchId?: string | null;
  label?: string | null;
  excerptText?: string | null;
  previewText?: string;
  onSuccess?: () => void;
}

export const AddToCollectionModal: React.FC<AddToCollectionModalProps> = ({
  isOpen,
  onClose,
  sourceType,
  sourceId,
  sessionId,
  branchId,
  label,
  excerptText,
  previewText,
  onSuccess,
}) => {
  const [collections, setCollections] = useState<ContextCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [itemLabel, setItemLabel] = useState(label || "");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsSaved(false);
      setErrorMsg(null);
      listCollections().then((cols) => {
        setCollections(cols);
        if (cols.length > 0) {
          setSelectedCollectionId(cols[0].id);
        } else {
          setIsCreatingNew(true);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      let targetCollectionId = selectedCollectionId;
      if (isCreatingNew) {
        if (!newCollectionName.trim()) {
          setErrorMsg("Please enter a collection name.");
          return;
        }
        const created = await createCollection({ name: newCollectionName.trim() });
        targetCollectionId = created.id;
      }

      if (!targetCollectionId) {
        setErrorMsg("Please select or create a collection.");
        return;
      }

      await addItemToCollection({
        collectionId: targetCollectionId,
        sourceType,
        sourceId,
        sessionId,
        branchId,
        label: itemLabel.trim() || null,
        excerptText: excerptText?.trim() || null,
      });

      setIsSaved(true);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 750);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add item to collection.");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-cc-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          backgroundColor: "var(--nr-bg-surface, #14171f)",
          border: "1px solid var(--nr-border-default, #27272a)",
          borderRadius: "var(--nr-radius-lg, 8px)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
          color: "var(--nr-text-primary, #ffffff)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "0.75rem 1rem",
            borderBottom: "1px solid var(--nr-border-default, #27272a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Layers style={{ width: "16px", height: "16px", color: "var(--nr-accent-purple, #a855f7)" }} />
            <h3 id="add-to-cc-title" style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0 }}>
              Add to Context Collection
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {errorMsg && (
            <div
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                border: "1px solid #ef4444",
                padding: "0.45rem 0.65rem",
                borderRadius: "4px",
                color: "#fca5a5",
                fontSize: "0.75rem",
              }}
            >
              {errorMsg}
            </div>
          )}

          {/* Privacy warning if adding a note */}
          {sourceType === "NOTE" && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                backgroundColor: "rgba(245, 158, 11, 0.12)",
                border: "1px solid #f59e0b",
                borderRadius: "6px",
                padding: "0.45rem 0.65rem",
                fontSize: "0.75rem",
                color: "#fbbf24",
              }}
            >
              <AlertTriangle style={{ width: "16px", height: "16px", flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>Privacy Notice:</strong> This is a private note. By adding it to a Context Collection, its text may be transmitted to AI providers if this collection is used in a future prompt.
              </div>
            </div>
          )}

          {/* Preview snippet */}
          {previewText && (
            <div>
              <label style={{ display: "block", fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)", marginBottom: "0.2rem" }}>
                Source Preview
              </label>
              <div
                style={{
                  maxHeight: "70px",
                  overflowY: "auto",
                  padding: "0.4rem 0.6rem",
                  backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                  border: "1px solid var(--nr-border-subtle, #1f222b)",
                  borderRadius: "4px",
                  fontSize: "0.75rem",
                  color: "var(--nr-text-secondary, #d4d4d8)",
                }}
              >
                {previewText}
              </div>
            </div>
          )}

          {/* Collection selection */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.3rem" }}>
              Target Collection
            </label>
            {!isCreatingNew && collections.length > 0 ? (
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <select
                  value={selectedCollectionId}
                  onChange={(e) => setSelectedCollectionId(e.target.value)}
                  style={{
                    flex: 1,
                    backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                    border: "1px solid var(--nr-border-default, #27272a)",
                    borderRadius: "4px",
                    padding: "0.4rem 0.5rem",
                    color: "white",
                    fontSize: "0.8rem",
                  }}
                >
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.isFavorite ? "★" : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(true)}
                  style={{
                    backgroundColor: "transparent",
                    border: "1px solid var(--nr-border-default, #27272a)",
                    borderRadius: "4px",
                    color: "var(--nr-text-secondary, #a1a1aa)",
                    padding: "0.35rem 0.55rem",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                >
                  <Plus style={{ width: "12px", height: "12px" }} />
                  <span>New</span>
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                <input
                  type="text"
                  placeholder="New collection name..."
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  style={{
                    backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                    border: "1px solid var(--nr-border-default, #27272a)",
                    borderRadius: "4px",
                    padding: "0.4rem 0.5rem",
                    color: "white",
                    fontSize: "0.8rem",
                  }}
                />
                {collections.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(false)}
                    style={{
                      alignSelf: "flex-start",
                      background: "transparent",
                      border: "none",
                      color: "var(--nr-accent-purple, #a855f7)",
                      fontSize: "0.7rem",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    ← Choose existing collection
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Optional item label */}
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem" }}>
              Reference Label (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Core Algorithm Specs"
              value={itemLabel}
              onChange={(e) => setItemLabel(e.target.value)}
              style={{
                width: "100%",
                backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                border: "1px solid var(--nr-border-default, #27272a)",
                borderRadius: "4px",
                padding: "0.4rem 0.5rem",
                color: "white",
                fontSize: "0.8rem",
              }}
            />
          </div>

          {/* Footer buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "0.5rem" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                backgroundColor: "transparent",
                border: "1px solid var(--nr-border-default, #27272a)",
                borderRadius: "4px",
                padding: "0.35rem 0.75rem",
                color: "white",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaved}
              style={{
                backgroundColor: isSaved ? "#10b981" : "var(--nr-accent-purple, #7c3aed)",
                border: "none",
                borderRadius: "4px",
                padding: "0.35rem 0.85rem",
                color: "white",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: isSaved ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
              }}
            >
              {isSaved ? (
                <>
                  <Check style={{ width: "14px", height: "14px" }} />
                  <span>Added!</span>
                </>
              ) : (
                <span>Add Reference</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

