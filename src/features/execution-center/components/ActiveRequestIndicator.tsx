/**
 * Nano Route — Active Request Indicator Trigger Component
 * File: src/features/execution-center/components/ActiveRequestIndicator.tsx
 *
 * Implements Step 85:
 * - Real-time task status indicator for application headers and control bars
 * - Shows live active request counts with subtle visual pulse when running
 * - Accessible trigger opening the full Active Request Center modal
 */

import React, { useState, useEffect } from "react";
import { Activity } from "lucide-react";
import { getExecutionStats, subscribeToExecutionTasks } from "../engine.ts";
import { ActiveRequestCenterModal } from "./ActiveRequestCenterModal.tsx";

export interface ActiveRequestIndicatorProps {
  onNavigateToSession?: (sessionId: string) => void;
  className?: string;
}

export const ActiveRequestIndicator: React.FC<ActiveRequestIndicatorProps> = ({
  onNavigateToSession,
  className = "",
}) => {
  const [activeCount, setActiveCount] = useState<number>(() => getExecutionStats().activeCount);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const handleUpdate = () => {
      setActiveCount(getExecutionStats().activeCount);
    };

    handleUpdate();
    const unsubscribe = subscribeToExecutionTasks(handleUpdate);
    return () => unsubscribe();
  }, []);

  const hasActive = activeCount > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        aria-label={hasActive ? `${activeCount} active requests running` : "Active Request Center (idle)"}
        title={hasActive ? `${activeCount} request(s) active — click to view` : "Active Request Center (idle)"}
        className={`nr-active-request-trigger ${className}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.35rem",
          padding: "0.25rem 0.55rem",
          borderRadius: "var(--nr-radius-sm, 4px)",
          border: hasActive
            ? "1px solid rgba(96, 165, 250, 0.5)"
            : "1px solid var(--nr-border-default, #27272a)",
          backgroundColor: hasActive
            ? "rgba(96, 165, 250, 0.12)"
            : "transparent",
          color: hasActive
            ? "#60a5fa"
            : "var(--nr-text-secondary, #a1a1aa)",
          fontSize: "0.75rem",
          cursor: "pointer",
          transition: "all 0.15s ease",
        }}
      >
        <Activity
          style={{
            width: "14px",
            height: "14px",
            color: hasActive ? "#60a5fa" : "inherit",
          }}
        />
        <span>{hasActive ? `${activeCount} Active` : "Requests"}</span>
      </button>

      <ActiveRequestCenterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onNavigateToSession={onNavigateToSession}
      />
    </>
  );
};

