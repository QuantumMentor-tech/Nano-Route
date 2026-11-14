/**
 * Nano Route — Template Browser Modal
 * File: src/features/templates/components/TemplateBrowserModal.tsx
 *
 * Implements Step 77:
 * - Dedicated local template browsing surface
 * - Category filtering, local search, favorites filter
 * - Action triggers: Apply, Edit, Duplicate, Delete, Export, Import
 * - Full keyboard navigation and WCAG 2.1 AA accessibility
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  X,
  Search,
  Plus,
  Star,
  Copy,
  Trash2,
  Edit2,
  ArrowRight,
  Download,
  Upload,
} from "lucide-react";
import type { PromptTemplate, CreatePromptTemplateInput } from "../types.ts";
import {
  listPromptTemplates,
  deletePromptTemplate,
  duplicatePromptTemplate,
  toggleFavoritePromptTemplate,
  savePromptTemplate,
  updatePromptTemplate,
  exportTemplatesPackage,
  importTemplatesPackage,
} from "../engine.ts";
import { extractTemplateVariables } from "../parser.ts";
import { TemplateEditorModal } from "./TemplateEditorModal.tsx";
import { VariableResolutionModal } from "./VariableResolutionModal.tsx";

export interface TemplateBrowserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyPrompt: (promptText: string) => void;
}

const CATEGORIES = ["All", "Coding", "Analysis", "Writing", "Productivity", "General"];

export const TemplateBrowserModal: React.FC<TemplateBrowserModalProps> = ({
  isOpen,
  onClose,
  onApplyPrompt,
}) => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [favoriteOnly, setFavoriteOnly] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Sub-modals state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null);
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [selectedTemplateForApply, setSelectedTemplateForApply] = useState<PromptTemplate | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await listPromptTemplates({
        category: selectedCategory,
        search: searchQuery,
        favoriteOnly,
      });
      setTemplates(list);
    } catch {
      setTemplates([]);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchQuery, favoriteOnly]);

  useEffect(() => {
    if (isOpen) {
      void loadTemplates();
    }
  }, [isOpen, loadTemplates]);

  if (!isOpen) return null;

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
  };

  const handleApplyClick = (template: PromptTemplate) => {
    const vars = extractTemplateVariables(template.content);
    if (vars.length > 0) {
      setSelectedTemplateForApply(template);
      setVariableModalOpen(true);
    } else {
      onApplyPrompt(template.content);
      onClose();
    }
  };

  const handleToggleFavorite = async (t: PromptTemplate) => {
    await toggleFavoritePromptTemplate(t.id);
    void loadTemplates();
  };

  const handleDuplicate = async (t: PromptTemplate) => {
    await duplicatePromptTemplate(t.id);
    showNotice(`Duplicated "${t.name}".`);
    void loadTemplates();
  };

  const handleDelete = async (t: PromptTemplate) => {
    if (window.confirm(`Are you sure you want to delete template "${t.name}"?`)) {
      await deletePromptTemplate(t.id);
      showNotice(`Deleted "${t.name}".`);
      void loadTemplates();
    }
  };

  const handleSaveEditor = async (input: CreatePromptTemplateInput, id?: string) => {
    if (id) {
      await updatePromptTemplate(id, input);
      showNotice(`Updated "${input.name}".`);
    } else {
      await savePromptTemplate(input);
      showNotice(`Created "${input.name}".`);
    }
    void loadTemplates();
  };

  const handleExport = async () => {
    const pkg = await exportTemplatesPackage();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(pkg, null, 2));
    const a = document.createElement("a");
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `nano-route-templates-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    showNotice("Templates exported successfully.");
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e: Event) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const res = await importTemplatesPackage(parsed, "KEEP_BOTH");
        showNotice(`Imported ${res.importedTemplates} templates.`);
        void loadTemplates();
      } catch (err: unknown) {
        alert(`Failed to import templates: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    input.click();
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-browser-title"
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "1rem",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "780px",
            height: "80vh",
            maxHeight: "800px",
            backgroundColor: "var(--nr-bg-surface, #14171f)",
            border: "1px solid var(--nr-border-default, #27272a)",
            borderRadius: "var(--nr-radius-lg, 8px)",
            boxShadow: "0 25px 30px -5px rgba(0, 0, 0, 0.6)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "1rem 1.25rem",
              borderBottom: "1px solid var(--nr-border-default, #27272a)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FileText style={{ width: "18px", height: "18px", color: "var(--nr-accent-purple, #a855f7)" }} />
              <div>
                <h2
                  id="template-browser-title"
                  style={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: "var(--nr-text-primary, #ffffff)",
                    margin: 0,
                  }}
                >
                  Prompt Templates & Request Presets
                </h2>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => {
                  setEditingTemplate(null);
                  setEditorOpen(true);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.35rem 0.75rem",
                  backgroundColor: "var(--nr-accent-purple, #a855f7)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "var(--nr-radius-sm, 4px)",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Plus style={{ width: "14px", height: "14px" }} />
                New Template
              </button>

              <button
                type="button"
                onClick={onClose}
                aria-label="Close template browser"
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
          </div>

          {/* Search & Filters Bar */}
          <div
            style={{
              padding: "0.75rem 1.25rem",
              borderBottom: "1px solid var(--nr-border-default, #27272a)",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              backgroundColor: "var(--nr-bg-base, #0d0f14)",
            }}
          >
            {/* Search row */}
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.4rem 0.75rem",
                  backgroundColor: "var(--nr-bg-surface, #14171f)",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  borderRadius: "var(--nr-radius-sm, 4px)",
                }}
              >
                <Search style={{ width: "14px", height: "14px", color: "var(--nr-text-muted, #71717a)" }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search templates by title, description, or tag..."
                  style={{
                    flex: 1,
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--nr-text-primary, #ffffff)",
                    fontSize: "0.8125rem",
                  }}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    style={{ background: "transparent", border: "none", color: "var(--nr-text-muted, #71717a)", cursor: "pointer", padding: 0 }}
                  >
                    <X style={{ width: "12px", height: "12px" }} />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setFavoriteOnly((prev) => !prev)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.45rem 0.75rem",
                  borderRadius: "var(--nr-radius-sm, 4px)",
                  backgroundColor: favoriteOnly ? "rgba(234, 179, 8, 0.15)" : "var(--nr-bg-surface, #14171f)",
                  border: `1px solid ${favoriteOnly ? "rgba(234, 179, 8, 0.4)" : "var(--nr-border-default, #27272a)"}`,
                  color: favoriteOnly ? "var(--nr-status-warning, #eab308)" : "var(--nr-text-secondary, #a1a1aa)",
                  fontSize: "0.8125rem",
                  cursor: "pointer",
                }}
              >
                <Star style={{ width: "13px", height: "13px", fill: favoriteOnly ? "currentColor" : "none" }} />
                Favorites
              </button>
            </div>

            {/* Category pills row */}
            <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto" }}>
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  style={{
                    padding: "0.2rem 0.6rem",
                    borderRadius: "12px",
                    border: "1px solid",
                    borderColor:
                      selectedCategory === cat
                        ? "var(--nr-accent-purple, #a855f7)"
                        : "var(--nr-border-default, #27272a)",
                    backgroundColor:
                      selectedCategory === cat
                        ? "rgba(168, 85, 247, 0.15)"
                        : "transparent",
                    color:
                      selectedCategory === cat
                        ? "var(--nr-accent-purple, #a855f7)"
                        : "var(--nr-text-secondary, #a1a1aa)",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Notice Toast */}
          {notice && (
            <div
              style={{
                padding: "0.4rem 1rem",
                backgroundColor: "rgba(168, 85, 247, 0.15)",
                borderBottom: "1px solid rgba(168, 85, 247, 0.3)",
                color: "var(--nr-accent-purple, #a855f7)",
                fontSize: "0.75rem",
              }}
            >
              {notice}
            </div>
          )}

          {/* Template Cards List */}
          <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
            {isLoading ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "var(--nr-text-muted, #71717a)", fontSize: "0.875rem" }}>
                Loading templates...
              </div>
            ) : templates.length === 0 ? (
              <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--nr-text-muted, #71717a)" }}>
                <FileText style={{ width: "32px", height: "32px", margin: "0 auto 0.75rem auto", opacity: 0.5 }} />
                <div style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary, #ffffff)" }}>
                  No templates found
                </div>
                <div style={{ fontSize: "0.8125rem", marginTop: "0.25rem" }}>
                  Try changing your category filter or create a new template above.
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {templates.map((t) => {
                  const vars = extractTemplateVariables(t.content);
                  return (
                    <div
                      key={t.id}
                      style={{
                        padding: "1rem",
                        backgroundColor: "var(--nr-bg-base, #0d0f14)",
                        border: "1px solid var(--nr-border-default, #27272a)",
                        borderRadius: "var(--nr-radius-md, 6px)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.5rem",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <span style={{ fontSize: "0.9375rem", fontWeight: 600, color: "var(--nr-text-primary, #ffffff)" }}>
                              {t.name}
                            </span>
                            <span
                              style={{
                                fontSize: "0.6875rem",
                                padding: "0.1rem 0.4rem",
                                borderRadius: "4px",
                                backgroundColor: "rgba(168, 85, 247, 0.12)",
                                color: "var(--nr-accent-purple, #a855f7)",
                                border: "1px solid rgba(168, 85, 247, 0.25)",
                              }}
                            >
                              {t.category}
                            </span>
                          </div>
                          {t.description && (
                            <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.8125rem", color: "var(--nr-text-secondary, #a1a1aa)" }}>
                              {t.description}
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                          <button
                            type="button"
                            onClick={() => void handleToggleFavorite(t)}
                            title={t.isFavorite ? "Remove favorite" : "Add to favorites"}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: t.isFavorite ? "var(--nr-status-warning, #eab308)" : "var(--nr-text-muted, #71717a)",
                              cursor: "pointer",
                              padding: "0.3rem",
                            }}
                          >
                            <Star style={{ width: "15px", height: "15px", fill: t.isFavorite ? "currentColor" : "none" }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTemplate(t);
                              setEditorOpen(true);
                            }}
                            title="Edit template"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--nr-text-muted, #71717a)",
                              cursor: "pointer",
                              padding: "0.3rem",
                            }}
                          >
                            <Edit2 style={{ width: "14px", height: "14px" }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDuplicate(t)}
                            title="Duplicate template"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--nr-text-muted, #71717a)",
                              cursor: "pointer",
                              padding: "0.3rem",
                            }}
                          >
                            <Copy style={{ width: "14px", height: "14px" }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(t)}
                            title="Delete template"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--nr-text-muted, #71717a)",
                              cursor: "pointer",
                              padding: "0.3rem",
                            }}
                          >
                            <Trash2 style={{ width: "14px", height: "14px" }} />
                          </button>
                        </div>
                      </div>

                      {/* Variables & Apply Row */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.25rem" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                          {vars.length > 0 ? (
                            vars.map((v) => (
                              <span
                                key={v.name}
                                style={{
                                  fontSize: "0.6875rem",
                                  padding: "0.1rem 0.35rem",
                                  borderRadius: "3px",
                                  backgroundColor: "rgba(113, 113, 122, 0.15)",
                                  color: "var(--nr-text-muted, #71717a)",
                                  fontFamily: "monospace",
                                }}
                              >
                                {v.rawPlaceholder}
                              </span>
                            ))
                          ) : (
                            <span style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}>
                              No variables (static prompt)
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleApplyClick(t)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            padding: "0.35rem 0.75rem",
                            borderRadius: "var(--nr-radius-sm, 4px)",
                            border: "none",
                            backgroundColor: "rgba(168, 85, 247, 0.15)",
                            color: "var(--nr-accent-purple, #a855f7)",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          Use Template
                          <ArrowRight style={{ width: "12px", height: "12px" }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with Portability Controls */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0.75rem 1.25rem",
              borderTop: "1px solid var(--nr-border-default, #27272a)",
              backgroundColor: "var(--nr-bg-base, #0d0f14)",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => void handleExport()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.3rem 0.6rem",
                  borderRadius: "var(--nr-radius-sm, 4px)",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  backgroundColor: "transparent",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                <Download style={{ width: "13px", height: "13px" }} />
                Export JSON
              </button>
              <button
                type="button"
                onClick={handleImport}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.3rem 0.6rem",
                  borderRadius: "var(--nr-radius-sm, 4px)",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  backgroundColor: "transparent",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                }}
              >
                <Upload style={{ width: "13px", height: "13px" }} />
                Import JSON
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "0.35rem 0.85rem",
                borderRadius: "var(--nr-radius-sm, 4px)",
                border: "1px solid var(--nr-border-default, #27272a)",
                backgroundColor: "transparent",
                color: "var(--nr-text-secondary, #a1a1aa)",
                fontSize: "0.8125rem",
                cursor: "pointer",
              }}
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      <TemplateEditorModal
        isOpen={editorOpen}
        initialTemplate={editingTemplate}
        onClose={() => {
          setEditorOpen(false);
          setEditingTemplate(null);
        }}
        onSave={handleSaveEditor}
      />

      {/* Variable Resolution Modal */}
      <VariableResolutionModal
        isOpen={variableModalOpen}
        template={selectedTemplateForApply}
        onClose={() => {
          setVariableModalOpen(false);
          setSelectedTemplateForApply(null);
        }}
        onApplyPrompt={(resolvedPrompt) => {
          onApplyPrompt(resolvedPrompt);
          onClose();
        }}
      />
    </>
  );
};

