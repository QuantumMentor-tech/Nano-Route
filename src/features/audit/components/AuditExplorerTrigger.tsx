/**
 * Nano Route — Local Audit Trail Trigger Component
 * File: src/features/audit/components/AuditExplorerTrigger.tsx
 *
 * Implements Step 89:
 * - Header/surface button triggering the Audit Explorer modal
 * - Displays activity icon and keyboard-accessible trigger
 */

import React, { useState } from "react";
import { Activity } from "lucide-react";
import { AuditExplorerModal } from "./AuditExplorerModal.tsx";

export interface AuditExplorerTriggerProps {
  variant?: "button" | "compact";
  onNavigateToPrivacyCenter?: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToRequestInspector?: () => void;
}

export const AuditExplorerTrigger: React.FC<AuditExplorerTriggerProps> = ({
  variant = "button",
  onNavigateToPrivacyCenter,
  onNavigateToSettings,
  onNavigateToRequestInspector,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open Local Audit Trail & Activity Review"
        title="Inspect security events, configuration history, and operational activity"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          padding: variant === "compact" ? "0.22rem 0.5rem" : "0.35rem 0.65rem",
          borderRadius: "6px",
          backgroundColor: "rgba(147, 51, 234, 0.12)",
          border: "1px solid rgba(147, 51, 234, 0.3)",
          color: "#c084fc",
          fontSize: "0.75rem",
          fontWeight: 500,
          cursor: "pointer",
          outline: "none",
          transition: "all 0.15s ease",
        }}
      >
        <Activity style={{ width: "13px", height: "13px" }} />
        <span>{variant === "compact" ? "Audit" : "Audit Trail"}</span>
      </button>

      <AuditExplorerModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onNavigateToPrivacyCenter={onNavigateToPrivacyCenter}
        onNavigateToSettings={onNavigateToSettings}
        onNavigateToRequestInspector={onNavigateToRequestInspector}
      />
    </>
  );
};

