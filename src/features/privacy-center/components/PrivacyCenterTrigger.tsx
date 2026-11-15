/**
 * Nano Route — Privacy & Data Governance Center Trigger Component
 * File: src/features/privacy-center/components/PrivacyCenterTrigger.tsx
 *
 * Implements Step 88:
 * - Header/surface button triggering the Privacy Center modal
 * - Displays local-first badge and shield icon
 * - Accessible keyboard trigger with ARIA labels
 */

import React, { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PrivacyCenterModal } from "./PrivacyCenterModal.tsx";

export interface PrivacyCenterTriggerProps {
  variant?: "button" | "compact";
  onNavigateToRequestInspector?: () => void;
  onNavigateToExport?: () => void;
  onNavigateToReset?: () => void;
  onNavigateToSettings?: () => void;
}

export const PrivacyCenterTrigger: React.FC<PrivacyCenterTriggerProps> = ({
  variant = "button",
  onNavigateToRequestInspector,
  onNavigateToExport,
  onNavigateToReset,
  onNavigateToSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open Privacy & Data Governance Center"
        title="Inspect local data inventory, retention policies, and data flow disclosures"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          padding: variant === "compact" ? "0.22rem 0.5rem" : "0.35rem 0.65rem",
          borderRadius: "6px",
          backgroundColor: "rgba(16, 185, 129, 0.12)",
          border: "1px solid rgba(16, 185, 129, 0.3)",
          color: "#34d399",
          fontSize: "0.75rem",
          fontWeight: 500,
          cursor: "pointer",
          outline: "none",
          transition: "all 0.15s ease",
        }}
      >
        <ShieldCheck style={{ width: "13px", height: "13px" }} />
        <span>{variant === "compact" ? "Privacy" : "Privacy & Governance"}</span>
      </button>

      <PrivacyCenterModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onNavigateToRequestInspector={onNavigateToRequestInspector}
        onNavigateToExport={onNavigateToExport}
        onNavigateToReset={onNavigateToReset}
        onNavigateToSettings={onNavigateToSettings}
      />
    </>
  );
};

