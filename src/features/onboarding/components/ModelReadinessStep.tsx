import React from "react";
import type { ModelDescriptorDto } from "../../../services/ipc";

export interface ModelReadinessStepProps {
  models: ModelDescriptorDto[];
}

export const ModelReadinessStep: React.FC<ModelReadinessStepProps> = ({ models }) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      <div>
        <h3
          id="onboarding-step-heading"
          style={{
            margin: "0 0 0.5rem",
            fontSize: "1.375rem",
            fontWeight: 700,
            color: "var(--nr-text-primary)",
          }}
        >
          Authoritative Model Catalog
        </h3>
        <p style={{ margin: 0, fontSize: "0.9375rem", color: "var(--nr-text-secondary)" }}>
          Nano Route maintains an authoritative registry of models across local execution and cloud providers. The router selects the optimal model based on prompt token requirements and capabilities.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "0.75rem",
          maxHeight: "260px",
          overflowY: "auto",
          paddingRight: "0.25rem",
        }}
      >
        {models.map((model) => (
          <div
            key={`${model.providerId}:${model.modelId}`}
            style={{
              padding: "0.875rem",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--nr-border-default)",
              borderRadius: "var(--nr-radius-md)",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <span style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--nr-text-primary)" }}>
                  {model.displayName}
                </span>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.75rem",
                    color: "var(--nr-text-secondary)",
                    fontFamily: "var(--nr-font-mono)",
                  }}
                >
                  {model.providerId} / {model.modelId}
                </span>
              </div>
              {model.isDefault && (
                <span
                  style={{
                    fontSize: "0.6875rem",
                    padding: "0.125rem 0.375rem",
                    borderRadius: "4px",
                    backgroundColor: "rgba(139, 92, 246, 0.2)",
                    color: "var(--nr-accent-purple)",
                    fontWeight: 600,
                  }}
                >
                  Default
                </span>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "0.75rem",
                fontSize: "0.75rem",
                color: "var(--nr-text-secondary)",
                marginTop: "auto",
              }}
            >
              <span>Ctx: {model.contextWindow.toLocaleString()}</span>
              <span>•</span>
              <span>
                {typeof model.pricing?.inputCostPerMillion === "number" && model.pricing.inputCostPerMillion > 0
                  ? `$${model.pricing.inputCostPerMillion.toFixed(2)} / 1M`
                  : "Free"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
