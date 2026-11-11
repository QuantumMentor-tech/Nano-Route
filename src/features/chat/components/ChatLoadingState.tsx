/**
//! Nano Route — Chat Studio Loading State
//! File: src/features/chat/components/ChatLoadingState.tsx
//!
//! Staggered skeleton placeholders simulating loading messages in the timeline.
*/

import React from "react";
import { Skeleton } from "../../../components/ui/Skeleton";

export const ChatLoadingState: React.FC = () => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5rem",
        padding: "1.5rem",
        width: "100%",
      }}
    >
      {/* Simulated User Message Skeleton */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
        <Skeleton width="60px" height="14px" />
        <Skeleton width="45%" height="52px" style={{ borderRadius: "8px 8px 0 8px" }} />
      </div>

      {/* Simulated Assistant Message Skeleton */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.5rem" }}>
        <Skeleton width="180px" height="14px" />
        <Skeleton width="75%" height="84px" style={{ borderRadius: "0 8px 8px 8px" }} />
      </div>

      {/* Another Simulated Turn */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.5rem" }}>
        <Skeleton width="50px" height="14px" />
        <Skeleton width="35%" height="42px" style={{ borderRadius: "8px 8px 0 8px" }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.5rem" }}>
        <Skeleton width="160px" height="14px" />
        <Skeleton width="85%" height="110px" style={{ borderRadius: "0 8px 8px 8px" }} />
      </div>
    </div>
  );
};

