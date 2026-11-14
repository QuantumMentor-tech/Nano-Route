/**
 * Nano Route — Context Collections & Reference Packs Modal Component
 * File: src/features/context-collections/components/ContextCollectionModal.tsx
 *
 * Implements Step 83:
 * - Browses, creates, duplicates, and manages Context Collections
 * - Inspects and reorders collection reference items
 * - Highlights stale sources and private note sensitivity warnings
 * - Materializes reference packs and inserts them into the composer
 * - Accessible dialog with Obsidian/dark aesthetic
 */

import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Trash2,
  Copy,
  Star,
  Layers,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  FileText,
  MessageSquare,
  Paperclip,
  CheckCircle,
} from "lucide-react";
import {
  listCollections,
  createCollection,
  deleteCollection,
  duplicateCollection,
  getCollectionItems,
  materializeContextCollection,
  removeItemFromCollection,
  reorderCollectionItems,
  updateCollection,
} from "../engine.ts";
import {
  type ContextCollection,
  type ContextCollectionItem,
  type MaterializedContextResult,
  type ContextCollectionFilterType,
} from "../types.ts";

export interface ContextCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertContext?: (formattedContext: string) => void;
  resolverContext?: any;
}

export const ContextCollectionModal: React.FC<ContextCollectionModalProps> = ({
  isOpen,
  onClose,
  onInsertContext,
  resolverContext,
}) => {
  const [collections, setCollections] = useState<ContextCollection[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [items, setItems] = useState<ContextCollectionItem[]>([]);
  const [materialized, setMaterialized] = useState<MaterializedContextResult | null>(null);
  const [filterType, setFilterType] = useState<ContextCollectionFilterType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedNotification, setCopiedNotification] = useState(false);

  const loadCollections = async () => {
    try {
      const list = await listCollections({ filterType, searchQuery });
      setCollections(list);
      if (list.length > 0 && !selectedCollectionId) {
        setSelectedCollectionId(list[0].id);
      } else if (list.length === 0) {
        setSelectedCollectionId(null);
        setItems([]);
        setMaterialized(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load collections.");
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCollections();
    }
  }, [isOpen, filterType, searchQuery]);

  useEffect(() => {
    if (selectedCollectionId) {
      loadCollectionDetails(selectedCollectionId);
    }
  }, [selectedCollectionId]);

  const loadCollectionDetails = async (id: string) => {
    try {
      const itms = await getCollectionItems(id);
      setItems(itms);
      const mat = await materializeContextCollection(id, resolverContext);
      setMaterialized(mat);
      setErrorMsg(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load collection items.");
    }
  };

  if (!isOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    try {
      const created = await createCollection({
        name: newCollectionName.trim(),
        description: newCollectionDesc.trim() || null,
      });
      setNewCollectionName("");
      setNewCollectionDesc("");
      setIsCreating(false);
      await loadCollections();
      setSelectedCollectionId(created.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to create collection.");
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this collection? Reference sources in chat history will remain safe.")) {
      await deleteCollection(id);
      if (selectedCollectionId === id) {
        setSelectedCollectionId(null);
      }
      await loadCollections();
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const dup = await duplicateCollection(id);
      await loadCollections();
      setSelectedCollectionId(dup.id);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to duplicate collection.");
    }
  };

  const handleToggleFavorite = async (col: ContextCollection) => {
    await updateCollection(col.id, { isFavorite: !col.isFavorite });
    await loadCollections();
  };

  const handleRemoveItem = async (itemId: string) => {
    await removeItemFromCollection(itemId);
    if (selectedCollectionId) {
      await loadCollectionDetails(selectedCollectionId);
    }
  };

  const handleMoveItem = async (index: number, direction: "up" | "down") => {
    if (!selectedCollectionId) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const newOrder = [...items];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    await reorderCollectionItems(
      selectedCollectionId,
      newOrder.map((i) => i.id)
    );
    await loadCollectionDetails(selectedCollectionId);
  };

  const handleInsert = () => {
    if (materialized && onInsertContext) {
      onInsertContext(materialized.formattedContext);
      onClose();
    }
  };

  const handleCopyContext = () => {
    if (materialized) {
      navigator.clipboard.writeText(materialized.formattedContext);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 2000);
    }
  };

  const selectedCollection = collections.find((c) => c.id === selectedCollectionId);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cc-modal-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "920px",
          height: "85vh",
          maxHeight: "720px",
          backgroundColor: "var(--nr-bg-surface, #14171f)",
          border: "1px solid var(--nr-border-default, #27272a)",
          borderRadius: "var(--nr-radius-lg, 8px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
          color: "var(--nr-text-primary, #ffffff)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "0.85rem 1.25rem",
            borderBottom: "1px solid var(--nr-border-default, #27272a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Layers style={{ width: "18px", height: "18px", color: "var(--nr-accent-purple, #a855f7)" }} />
            <h2 id="cc-modal-title" style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>
              Context Collections & Reference Packs
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--nr-text-muted, #71717a)",
              cursor: "pointer",
              padding: "0.25rem",
              borderRadius: "4px",
            }}
          >
            <X style={{ width: "18px", height: "18px" }} />
          </button>
        </div>

        {/* Content Layout */}
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {/* Sidebar: Collections list */}
          <div
            style={{
              width: "280px",
              borderRight: "1px solid var(--nr-border-default, #27272a)",
              display: "flex",
              flexDirection: "column",
              backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
            }}
          >
            {/* Search & Actions */}
            <div style={{ padding: "0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  type="text"
                  placeholder="Filter packs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    flex: 1,
                    backgroundColor: "var(--nr-bg-surface, #14171f)",
                    border: "1px solid var(--nr-border-default, #27272a)",
                    borderRadius: "4px",
                    padding: "0.35rem 0.5rem",
                    color: "white",
                    fontSize: "0.75rem",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  title="Create new collection"
                  style={{
                    backgroundColor: "var(--nr-accent-purple, #7c3aed)",
                    border: "none",
                    borderRadius: "4px",
                    color: "white",
                    padding: "0.35rem 0.6rem",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    fontSize: "0.75rem",
                  }}
                >
                  <Plus style={{ width: "14px", height: "14px" }} />
                  <span>New</span>
                </button>
              </div>

              {/* Filter tabs */}
              <div style={{ display: "flex", gap: "0.25rem", fontSize: "0.7rem" }}>
                {(["ALL", "FAVORITES", "WITH_NOTES"] as ContextCollectionFilterType[]).map((ft) => (
                  <button
                    key={ft}
                    type="button"
                    onClick={() => setFilterType(ft)}
                    style={{
                      padding: "0.2rem 0.4rem",
                      borderRadius: "4px",
                      border: "none",
                      backgroundColor: filterType === ft ? "var(--nr-accent-purple, #7c3aed)" : "transparent",
                      color: filterType === ft ? "white" : "var(--nr-text-muted, #71717a)",
                      cursor: "pointer",
                    }}
                  >
                    {ft === "ALL" ? "All" : ft === "FAVORITES" ? "★ Starred" : "Notes"}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: "auto", padding: "0 0.5rem 0.5rem 0.5rem" }}>
              {collections.map((col) => {
                const isSelected = col.id === selectedCollectionId;
                return (
                  <div
                    key={col.id}
                    onClick={() => setSelectedCollectionId(col.id)}
                    style={{
                      padding: "0.6rem 0.75rem",
                      borderRadius: "6px",
                      marginBottom: "0.35rem",
                      backgroundColor: isSelected
                        ? "var(--nr-bg-surface-hover, #1f232e)"
                        : "transparent",
                      border: isSelected
                        ? "1px solid var(--nr-accent-purple, #7c3aed)"
                        : "1px solid transparent",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, marginRight: "0.5rem" }}>
                      <div
                        style={{
                          fontSize: "0.85rem",
                          fontWeight: isSelected ? 600 : 400,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {col.name}
                      </div>
                      {col.description && (
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--nr-text-muted, #71717a)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {col.description}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFavorite(col);
                      }}
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        color: col.isFavorite ? "#fbbf24" : "var(--nr-text-muted, #52525b)",
                        padding: "0.15rem",
                      }}
                    >
                      <Star style={{ width: "14px", height: "14px", fill: col.isFavorite ? "#fbbf24" : "none" }} />
                    </button>
                  </div>
                );
              })}

              {collections.length === 0 && (
                <div style={{ padding: "1.5rem 1rem", textAlign: "center", color: "var(--nr-text-muted, #71717a)", fontSize: "0.75rem" }}>
                  No context collections found.
                </div>
              )}
            </div>
          </div>

          {/* Main Panel: Collection Details, Items & Preview */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, padding: "1rem" }}>
            {errorMsg && (
              <div
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid #ef4444",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "4px",
                  color: "#fca5a5",
                  fontSize: "0.75rem",
                  marginBottom: "0.75rem",
                }}
              >
                {errorMsg}
              </div>
            )}

            {isCreating ? (
              <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <h3 style={{ fontSize: "0.95rem", margin: 0, fontWeight: 600 }}>Create New Context Pack</h3>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem" }}>Collection Name *</label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="e.g. Project Architecture Docs"
                    style={{
                      width: "100%",
                      backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                      border: "1px solid var(--nr-border-default, #27272a)",
                      borderRadius: "4px",
                      padding: "0.45rem 0.6rem",
                      color: "white",
                      fontSize: "0.8rem",
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", marginBottom: "0.25rem" }}>Description (Optional)</label>
                  <textarea
                    maxLength={500}
                    value={newCollectionDesc}
                    onChange={(e) => setNewCollectionDesc(e.target.value)}
                    placeholder="Brief description of reference pack scope"
                    rows={3}
                    style={{
                      width: "100%",
                      backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                      border: "1px solid var(--nr-border-default, #27272a)",
                      borderRadius: "4px",
                      padding: "0.45rem 0.6rem",
                      color: "white",
                      fontSize: "0.8rem",
                      resize: "vertical",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    onClick={() => setIsCreating(false)}
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
                    style={{
                      backgroundColor: "var(--nr-accent-purple, #7c3aed)",
                      border: "none",
                      borderRadius: "4px",
                      padding: "0.35rem 0.75rem",
                      color: "white",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Save Collection
                  </button>
                </div>
              </form>
            ) : selectedCollection ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
                {/* Collection Meta & Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "0.75rem",
                    paddingBottom: "0.75rem",
                    borderBottom: "1px solid var(--nr-border-subtle, #1f222b)",
                  }}
                >
                  <div>
                    <h3 style={{ fontSize: "1rem", margin: 0, fontWeight: 600 }}>{selectedCollection.name}</h3>
                    {selectedCollection.description && (
                      <p style={{ fontSize: "0.75rem", color: "var(--nr-text-secondary, #a1a1aa)", margin: "0.2rem 0 0 0" }}>
                        {selectedCollection.description}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.35rem", fontSize: "0.7rem", color: "var(--nr-text-muted, #71717a)" }}>
                      <span>{items.length} items</span>
                      {materialized && (
                        <>
                          <span>~{materialized.totalEstimatedTokens.toLocaleString()} tokens</span>
                          <span>{materialized.totalCharCount.toLocaleString()} chars</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(selectedCollection.id)}
                      title="Duplicate Collection"
                      style={{
                        backgroundColor: "transparent",
                        border: "1px solid var(--nr-border-default, #27272a)",
                        borderRadius: "4px",
                        color: "var(--nr-text-secondary, #a1a1aa)",
                        padding: "0.3rem 0.5rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.75rem",
                      }}
                    >
                      <Copy style={{ width: "12px", height: "12px" }} />
                      <span>Duplicate</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(selectedCollection.id)}
                      title="Delete Collection"
                      style={{
                        backgroundColor: "transparent",
                        border: "1px solid var(--nr-border-default, #27272a)",
                        borderRadius: "4px",
                        color: "#ef4444",
                        padding: "0.3rem 0.5rem",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.25rem",
                        fontSize: "0.75rem",
                      }}
                    >
                      <Trash2 style={{ width: "12px", height: "12px" }} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>

                {/* Sensitive Note Warning Banner if applicable */}
                {materialized?.hasSensitiveNotes && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      backgroundColor: "rgba(245, 158, 11, 0.12)",
                      border: "1px solid #f59e0b",
                      borderRadius: "6px",
                      padding: "0.45rem 0.75rem",
                      fontSize: "0.75rem",
                      color: "#fbbf24",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <AlertTriangle style={{ width: "16px", height: "16px", flexShrink: 0 }} />
                    <span>
                      Notice: This collection contains private notes. Inserting it into the composer will include note text in the prompt sent to the model provider.
                    </span>
                  </div>
                )}

                {/* Items List */}
                <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {materialized?.items.map((item, index) => {
                    const isStale = item.status === "STALE";
                    return (
                      <div
                        key={item.id}
                        style={{
                          backgroundColor: "var(--nr-bg-surface-subtle, #0d0f14)",
                          border: isStale ? "1px solid #ef4444" : "1px solid var(--nr-border-default, #27272a)",
                          borderRadius: "6px",
                          padding: "0.6rem 0.75rem",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.35rem",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.75rem" }}>
                            {item.sourceType === "MESSAGE" && <MessageSquare style={{ width: "12px", height: "12px", color: "#60a5fa" }} />}
                            {item.sourceType === "MESSAGE_EXCERPT" && <FileText style={{ width: "12px", height: "12px", color: "#34d399" }} />}
                            {item.sourceType === "NOTE" && <FileText style={{ width: "12px", height: "12px", color: "#fbbf24" }} />}
                            {item.sourceType === "ATTACHMENT_REFERENCE" && <Paperclip style={{ width: "12px", height: "12px", color: "#c084fc" }} />}
                            <span style={{ fontWeight: 600, color: "var(--nr-text-secondary, #d4d4d8)" }}>
                              {item.sourceType === "MESSAGE"
                                ? "Message"
                                : item.sourceType === "MESSAGE_EXCERPT"
                                ? "Excerpt"
                                : item.sourceType === "NOTE"
                                ? "Private Note"
                                : "Attachment"}
                            </span>
                            {item.label && <span style={{ color: "var(--nr-text-muted, #71717a)" }}>({item.label})</span>}
                            {isStale && (
                              <span style={{ color: "#ef4444", fontSize: "0.65rem", padding: "0.1rem 0.3rem", borderRadius: "3px", backgroundColor: "rgba(239, 68, 68, 0.15)" }}>
                                STALE
                              </span>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <button
                              type="button"
                              disabled={index === 0}
                              onClick={() => handleMoveItem(index, "up")}
                              title="Move Up"
                              style={{
                                background: "transparent",
                                border: "none",
                                color: index === 0 ? "#3f3f46" : "#a1a1aa",
                                cursor: index === 0 ? "default" : "pointer",
                                padding: "0.15rem",
                              }}
                            >
                              <ArrowUp style={{ width: "12px", height: "12px" }} />
                            </button>
                            <button
                              type="button"
                              disabled={index === items.length - 1}
                              onClick={() => handleMoveItem(index, "down")}
                              title="Move Down"
                              style={{
                                background: "transparent",
                                border: "none",
                                color: index === items.length - 1 ? "#3f3f46" : "#a1a1aa",
                                cursor: index === items.length - 1 ? "default" : "pointer",
                                padding: "0.15rem",
                              }}
                            >
                              <ArrowDown style={{ width: "12px", height: "12px" }} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(item.id)}
                              title="Remove item"
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#ef4444",
                                cursor: "pointer",
                                padding: "0.15rem",
                              }}
                            >
                              <Trash2 style={{ width: "12px", height: "12px" }} />
                            </button>
                          </div>
                        </div>

                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--nr-text-muted, #a1a1aa)",
                            whiteSpace: "pre-wrap",
                            maxHeight: "80px",
                            overflowY: "auto",
                            backgroundColor: "rgba(0, 0, 0, 0.2)",
                            padding: "0.35rem 0.5rem",
                            borderRadius: "4px",
                          }}
                        >
                          {item.resolvedContent}
                        </div>
                      </div>
                    );
                  })}

                  {items.length === 0 && (
                    <div style={{ padding: "2rem", textAlign: "center", color: "var(--nr-text-muted, #71717a)", fontSize: "0.8rem" }}>
                      This collection is empty. Use "Add to Collection" from any message or note to populate it.
                    </div>
                  )}
                </div>

                {/* Footer / Insert Controls */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingTop: "0.75rem",
                    marginTop: "0.5rem",
                    borderTop: "1px solid var(--nr-border-subtle, #1f222b)",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      type="button"
                      onClick={handleCopyContext}
                      disabled={!materialized || items.length === 0}
                      style={{
                        backgroundColor: "transparent",
                        border: "1px solid var(--nr-border-default, #27272a)",
                        borderRadius: "4px",
                        padding: "0.4rem 0.75rem",
                        color: "white",
                        fontSize: "0.75rem",
                        cursor: !materialized || items.length === 0 ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      {copiedNotification ? (
                        <>
                          <CheckCircle style={{ width: "12px", height: "12px", color: "#10b981" }} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy style={{ width: "12px", height: "12px" }} />
                          <span>Copy Raw Context</span>
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleInsert}
                    disabled={!materialized || items.length === 0}
                    style={{
                      backgroundColor: "var(--nr-accent-purple, #7c3aed)",
                      border: "none",
                      borderRadius: "6px",
                      padding: "0.45rem 1rem",
                      color: "white",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: !materialized || items.length === 0 ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <Layers style={{ width: "14px", height: "14px" }} />
                    <span>Insert into Composer</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ padding: "3rem", textAlign: "center", color: "var(--nr-text-muted, #71717a)", fontSize: "0.85rem" }}>
                Select a collection from the list or create a new one.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

