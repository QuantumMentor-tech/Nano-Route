/**
 * Nano Route — Template Editor Modal
 * File: src/features/templates/components/TemplateEditorModal.tsx
 *
 * Implements Step 77:
 * - Create and edit prompt templates with real-time variable detection
 * - Strict client-side validation and security sanitization
 * - Invariant: Zero secret storage in templates
 */

import React, { useState, useEffect } from "react";
import { Edit3, X, Save, AlertCircle, Code } from "lucide-react";
import type { PromptTemplate, CreatePromptTemplateInput } from "../types.ts";
import { extractTemplateVariables, validateTemplate } from "../parser.ts";

export interface TemplateEditorModalProps {
  isOpen: boolean;
  initialTemplate?: PromptTemplate | null;
  onClose: () => void;
  onSave: (input: CreatePromptTemplateInput, id?: string) => Promise<void>;
}

export const TemplateEditorModal: React.FC<TemplateEditorModalProps> = ({
  isOpen,
  initialTemplate,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("General");
  const [tagsString, setTagsString] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialTemplate) {
      setName(initialTemplate.name);
      setDescription(initialTemplate.description);
      setContent(initialTemplate.content);
      setCategory(initialTemplate.category);
      setTagsString(initialTemplate.tags.join(", "));
      setIsFavorite(initialTemplate.isFavorite);
    } else {
      setName("");
      setDescription("");
      setContent("");
      setCategory("General");
      setTagsString("");
      setIsFavorite(false);
    }
    setErrorNotice(null);
  }, [initialTemplate, isOpen]);

  if (!isOpen) return null;

  const detectedVariables = extractTemplateVariables(content);

  const handleSave = async () => {
    const tags = tagsString
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const validation = validateTemplate({
      name,
      content,
      category,
    });

    if (!validation.valid) {
      setErrorNotice(validation.errors.join(" "));
      return;
    }

    setIsSaving(true);
    setErrorNotice(null);
    try {
      await onSave(
        {
          name: name.trim(),
          description: description.trim(),
          content,
          category: category.trim(),
          tags,
          isFavorite,
        },
        initialTemplate?.id
      );
      onClose();
    } catch (err: unknown) {
      setErrorNotice(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="template-editor-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10001,
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "650px",
          backgroundColor: "var(--nr-bg-surface, #14171f)",
          border: "1px solid var(--nr-border-default, #27272a)",
          borderRadius: "var(--nr-radius-lg, 8px)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
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
            <Edit3 style={{ width: "18px", height: "18px", color: "var(--nr-accent-purple, #a855f7)" }} />
            <h2
              id="template-editor-title"
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--nr-text-primary, #ffffff)",
                margin: 0,
              }}
            >
              {initialTemplate ? "Edit Prompt Template" : "Create Prompt Template"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close editor"
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

        {/* Content Body */}
        <div style={{ padding: "1.25rem", overflowY: "auto", maxHeight: "70vh", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {errorNotice && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0.75rem",
                backgroundColor: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                borderRadius: "var(--nr-radius-sm, 4px)",
                color: "var(--nr-status-error, #ef4444)",
                fontSize: "0.75rem",
              }}
            >
              <AlertCircle style={{ width: "14px", height: "14px", flexShrink: 0 }} />
              <span>{errorNotice}</span>
            </div>
          )}

          {/* Name & Category Row */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "0.75rem" }}>
            <div>
              <label
                htmlFor="template-name-input"
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary, #ffffff)",
                  marginBottom: "0.3rem",
                }}
              >
                Template Name *
              </label>
              <input
                id="template-name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Detailed Code Review"
                maxLength={100}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  backgroundColor: "var(--nr-bg-base, #0d0f14)",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  borderRadius: "var(--nr-radius-sm, 4px)",
                  color: "var(--nr-text-primary, #ffffff)",
                  fontSize: "0.875rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="template-category-input"
                style={{
                  display: "block",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary, #ffffff)",
                  marginBottom: "0.3rem",
                }}
              >
                Category
              </label>
              <select
                id="template-category-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0.75rem",
                  backgroundColor: "var(--nr-bg-base, #0d0f14)",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  borderRadius: "var(--nr-radius-sm, 4px)",
                  color: "var(--nr-text-primary, #ffffff)",
                  fontSize: "0.875rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              >
                <option value="General">General</option>
                <option value="Coding">Coding</option>
                <option value="Writing">Writing</option>
                <option value="Analysis">Analysis</option>
                <option value="Research">Research</option>
                <option value="Productivity">Productivity</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label
              htmlFor="template-desc-input"
              style={{
                display: "block",
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--nr-text-primary, #ffffff)",
                marginBottom: "0.3rem",
              }}
            >
              Description
            </label>
            <input
              id="template-desc-input"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary of what this template generates..."
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                backgroundColor: "var(--nr-bg-base, #0d0f14)",
                border: "1px solid var(--nr-border-default, #27272a)",
                borderRadius: "var(--nr-radius-sm, 4px)",
                color: "var(--nr-text-primary, #ffffff)",
                fontSize: "0.875rem",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Content with Variable Guide */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <label
                htmlFor="template-content-input"
                style={{
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary, #ffffff)",
                }}
              >
                Template Prompt Content *
              </label>
              <span style={{ fontSize: "0.75rem", color: "var(--nr-text-muted, #71717a)" }}>
                Use <code style={{ color: "var(--nr-accent-purple, #a855f7)" }}>{"{{variable_name}}"}</code> for placeholders
              </span>
            </div>
            <textarea
              id="template-content-input"
              rows={8}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter your prompt structure here... e.g. Analyze the {{topic}} with focus on {{goal}}"
              style={{
                width: "100%",
                padding: "0.75rem",
                backgroundColor: "var(--nr-bg-base, #0d0f14)",
                border: "1px solid var(--nr-border-default, #27272a)",
                borderRadius: "var(--nr-radius-sm, 4px)",
                color: "var(--nr-text-primary, #ffffff)",
                fontSize: "0.875rem",
                fontFamily: "inherit",
                lineHeight: "1.4",
                outline: "none",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Detected Variables Bar */}
          {detectedVariables.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.5rem 0.75rem",
                backgroundColor: "rgba(168, 85, 247, 0.08)",
                border: "1px solid rgba(168, 85, 247, 0.25)",
                borderRadius: "var(--nr-radius-sm, 4px)",
              }}
            >
              <Code style={{ width: "13px", height: "13px", color: "var(--nr-accent-purple, #a855f7)" }} />
              <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--nr-accent-purple, #a855f7)" }}>
                {detectedVariables.length} variable(s) detected:
              </span>
              {detectedVariables.map((v) => (
                <span
                  key={v.name}
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.1rem 0.4rem",
                    borderRadius: "3px",
                    backgroundColor: "rgba(168, 85, 247, 0.2)",
                    color: "var(--nr-accent-purple, #a855f7)",
                    fontFamily: "monospace",
                  }}
                >
                  {v.rawPlaceholder}
                </span>
              ))}
            </div>
          )}

          {/* Tags & Favorite */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "center" }}>
            <div>
              <label
                htmlFor="template-tags-input"
                style={{
                  display: "block",
                  fontSize: "0.75rem",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                  marginBottom: "0.25rem",
                }}
              >
                Tags (comma separated)
              </label>
              <input
                id="template-tags-input"
                type="text"
                value={tagsString}
                onChange={(e) => setTagsString(e.target.value)}
                placeholder="e.g. review, code, quality"
                style={{
                  width: "100%",
                  padding: "0.4rem 0.6rem",
                  backgroundColor: "var(--nr-bg-base, #0d0f14)",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  borderRadius: "var(--nr-radius-sm, 4px)",
                  color: "var(--nr-text-primary, #ffffff)",
                  fontSize: "0.8125rem",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.5rem",
                fontSize: "0.8125rem",
                color: "var(--nr-text-primary, #ffffff)",
                cursor: "pointer",
                marginTop: "1.2rem",
              }}
            >
              <input
                type="checkbox"
                checked={isFavorite}
                onChange={(e) => setIsFavorite(e.target.checked)}
              />
              Mark as Favorite
            </label>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "0.5rem",
            padding: "1rem 1.25rem",
            borderTop: "1px solid var(--nr-border-default, #27272a)",
            backgroundColor: "var(--nr-bg-base, #0d0f14)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0.4rem 0.85rem",
              borderRadius: "var(--nr-radius-sm, 4px)",
              border: "1px solid var(--nr-border-default, #27272a)",
              backgroundColor: "transparent",
              color: "var(--nr-text-secondary, #a1a1aa)",
              fontSize: "0.8125rem",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.4rem 1rem",
              borderRadius: "var(--nr-radius-sm, 4px)",
              border: "none",
              backgroundColor: "var(--nr-accent-purple, #a855f7)",
              color: "#ffffff",
              fontSize: "0.8125rem",
              fontWeight: 600,
              cursor: isSaving ? "wait" : "pointer",
            }}
          >
            <Save style={{ width: "14px", height: "14px" }} />
            {isSaving ? "Saving..." : "Save Template"}
          </button>
        </div>
      </div>
    </div>
  );
};

