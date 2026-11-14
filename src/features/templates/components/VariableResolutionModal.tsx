/**
 * Nano Route — Template Variable Resolution Modal
 * File: src/features/templates/components/VariableResolutionModal.tsx
 *
 * Implements Step 77:
 * - Collects input values for template placeholders (e.g. {{topic}}, {{language}})
 * - Real-time live preview of the composed prompt
 * - Invariant: Never automatically submits to provider; user must review in composer
 */

import React, { useState } from "react";
import { Sliders, X, ArrowRight, Eye, AlertCircle } from "lucide-react";
import type { PromptTemplate } from "../types.ts";
import { extractTemplateVariables, resolveTemplateContent } from "../parser.ts";

export interface VariableResolutionModalProps {
  isOpen: boolean;
  template: PromptTemplate | null;
  onClose: () => void;
  onApplyPrompt: (resolvedPrompt: string) => void;
}

export const VariableResolutionModal: React.FC<VariableResolutionModalProps> = ({
  isOpen,
  template,
  onClose,
  onApplyPrompt,
}) => {
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [showPreview, setShowPreview] = useState<boolean>(true);

  if (!isOpen || !template) return null;

  const variables = extractTemplateVariables(template.content);
  const { resolved, unresolved } = resolveTemplateContent(template.content, variableValues);

  const handleInputChange = (varName: string, val: string) => {
    setVariableValues((prev) => ({
      ...prev,
      [varName]: val,
    }));
  };

  const handleApply = () => {
    onApplyPrompt(resolved);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="var-resolve-title"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
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
            <Sliders style={{ width: "18px", height: "18px", color: "var(--nr-accent-purple, #a855f7)" }} />
            <div>
              <h2
                id="var-resolve-title"
                style={{
                  fontSize: "1rem",
                  fontWeight: 600,
                  color: "var(--nr-text-primary, #ffffff)",
                  margin: 0,
                }}
              >
                Fill Template: {template.name}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close template variables dialog"
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
        <div style={{ padding: "1.25rem", overflowY: "auto", maxHeight: "65vh" }}>
          <p style={{ fontSize: "0.8125rem", color: "var(--nr-text-secondary, #a1a1aa)", margin: "0 0 1rem 0" }}>
            {template.description || "Provide inputs for the placeholders below to compose the final prompt."}
          </p>

          {/* Form fields for each variable */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", marginBottom: "1.25rem" }}>
            {variables.map((v) => (
              <div key={v.name}>
                <label
                  htmlFor={`var-input-${v.name}`}
                  style={{
                    display: "block",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "var(--nr-text-primary, #ffffff)",
                    marginBottom: "0.3rem",
                  }}
                >
                  {v.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  <span style={{ color: "var(--nr-accent-purple, #a855f7)", marginLeft: "0.35rem", fontSize: "0.75rem", fontFamily: "monospace" }}>
                    {v.rawPlaceholder}
                  </span>
                </label>
                <input
                  id={`var-input-${v.name}`}
                  type="text"
                  value={variableValues[v.name] || ""}
                  onChange={(e) => handleInputChange(v.name, e.target.value)}
                  placeholder={`Enter value for ${v.name}...`}
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
            ))}
          </div>

          {/* Unresolved notice if any */}
          {unresolved.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 0.75rem",
                backgroundColor: "rgba(234, 179, 8, 0.1)",
                border: "1px solid rgba(234, 179, 8, 0.3)",
                borderRadius: "var(--nr-radius-sm, 4px)",
                color: "var(--nr-status-warning, #eab308)",
                fontSize: "0.75rem",
                marginBottom: "1rem",
              }}
            >
              <AlertCircle style={{ width: "14px", height: "14px", flexShrink: 0 }} />
              <span>
                {unresolved.length} placeholder(s) still unfilled (will appear verbatim in draft):{" "}
                {unresolved.map((u) => `{{${u}}}`).join(", ")}
              </span>
            </div>
          )}

          {/* Live Preview Toggle & Box */}
          <div>
            <button
              type="button"
              onClick={() => setShowPreview((p) => !p)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                background: "transparent",
                border: "none",
                color: "var(--nr-text-secondary, #a1a1aa)",
                fontSize: "0.75rem",
                cursor: "pointer",
                padding: 0,
                marginBottom: "0.5rem",
              }}
            >
              <Eye style={{ width: "13px", height: "13px" }} />
              {showPreview ? "Hide Live Preview" : "Show Live Preview"}
            </button>

            {showPreview && (
              <pre
                style={{
                  margin: 0,
                  padding: "0.75rem",
                  backgroundColor: "var(--nr-bg-base, #0d0f14)",
                  border: "1px solid var(--nr-border-default, #27272a)",
                  borderRadius: "var(--nr-radius-md, 6px)",
                  fontSize: "0.75rem",
                  fontFamily: "monospace",
                  color: "var(--nr-text-secondary, #a1a1aa)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  maxHeight: "140px",
                  overflowY: "auto",
                }}
              >
                {resolved}
              </pre>
            )}
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
            onClick={handleApply}
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
              cursor: "pointer",
            }}
          >
            Insert into Composer
            <ArrowRight style={{ width: "14px", height: "14px" }} />
          </button>
        </div>
      </div>
    </div>
  );
};

