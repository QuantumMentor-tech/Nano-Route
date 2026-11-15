/**
 * Nano Route — Provider & Model Compatibility Center Trigger Component
 * File: src/features/provider-compatibility/components/CompatibilityCenterTrigger.tsx
 *
 * Implements Step 87:
 * - Header/surface button triggering the Compatibility Center modal
 * - Fully accessible with keyboard navigation and screen-reader support
 */

import React, { useState } from "react";
import { Layers } from "lucide-react";
import { CompatibilityCenterModal } from "./CompatibilityCenterModal.tsx";
import type { RequestRequirements } from "../types.ts";

export interface CompatibilityCenterTriggerProps {
  requestRequirements?: RequestRequirements;
  variant?: "button" | "compact";
  onNavigateToSettings?: () => void;
  onNavigateToConnectivity?: () => void;
}

export const CompatibilityCenterTrigger: React.FC<CompatibilityCenterTriggerProps> = ({
  requestRequirements,
  variant = "button",
  onNavigateToSettings,
  onNavigateToConnectivity,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open Provider & Model Compatibility Center"
        title="Explore provider readiness, model capabilities, context bounds, and request eligibility"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          padding: variant === "compact" ? "0.22rem 0.5rem" : "0.35rem 0.65rem",
          borderRadius: "6px",
          backgroundColor: "rgba(168, 85, 247, 0.12)",
          border: "1px solid rgba(168, 85, 247, 0.3)",
          color: "#c084fc",
          fontSize: "0.75rem",
          fontWeight: 500,
          cursor: "pointer",
          outline: "none",
          transition: "all 0.15s ease",
        }}
      >
        <Layers style={{ width: "13px", height: "13px" }} />
        <span>{variant === "compact" ? "Models" : "Models & Capabilities"}</span>
      </button>

      <CompatibilityCenterModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        requestRequirements={requestRequirements}
        onNavigateToSettings={onNavigateToSettings}
        onNavigateToConnectivity={onNavigateToConnectivity}
      />
    </>
  );
};

