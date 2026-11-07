import React from "react";

export type StatusType = "online" | "offline" | "routing" | "warning" | "error" | "busy";

export interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  size?: "sm" | "md";
  pulse?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  size = "md",
  pulse = false,
}) => {
  const getStatusColor = (): string => {
    switch (status) {
      case "online":
        return "var(--nr-status-success)";
      case "routing":
        return "var(--nr-accent-purple)";
      case "busy":
        return "var(--nr-accent-blue)";
      case "warning":
        return "var(--nr-status-warning)";
      case "error":
        return "var(--nr-status-error)";
      case "offline":
      default:
        return "var(--nr-text-disabled)";
    }
  };

  const dotSize = size === "sm" ? "6px" : "8px";
  const color = getStatusColor();

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.375rem",
        fontSize: size === "sm" ? "0.75rem" : "0.8125rem",
        fontFamily: "var(--nr-font-mono)",
        color: "var(--nr-text-secondary)",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: dotSize,
          height: dotSize,
          borderRadius: "var(--nr-radius-full)",
          backgroundColor: color,
          boxShadow: pulse ? `0 0 6px ${color}` : "none",
          display: "inline-block",
        }}
      />
      {label && <span>{label}</span>}
    </span>
  );
};

