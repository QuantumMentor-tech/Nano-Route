import React from "react";
import { Card } from "../ui/Card";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  compact = false,
  className = "",
  style,
}) => {
  return (
    <Card
      variant="default"
      padding={compact ? "md" : "lg"}
      className={`nr-empty-state ${className}`}
      style={{
        width: "100%",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          margin: "0 auto",
          padding: compact ? "1rem 0.5rem" : "2rem 1rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {icon && (
          <div
            style={{
              width: compact ? "40px" : "52px",
              height: compact ? "40px" : "52px",
              borderRadius: "var(--nr-radius-full)",
              backgroundColor: "var(--nr-bg-surface-elevated)",
              border: "1px solid var(--nr-border-default)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--nr-text-muted)",
              marginBottom: compact ? "0.75rem" : "1.25rem",
            }}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}

        <h3
          style={{
            fontSize: compact ? "0.9375rem" : "1.125rem",
            fontWeight: 600,
            color: "var(--nr-text-primary)",
            margin: "0 0 0.375rem",
          }}
        >
          {title}
        </h3>

        {description && (
          <p
            style={{
              fontSize: "0.8125rem",
              color: "var(--nr-text-secondary)",
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {description}
          </p>
        )}

        {(primaryAction || secondaryAction) && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.75rem",
              marginTop: compact ? "1rem" : "1.5rem",
            }}
          >
            {primaryAction}
            {secondaryAction}
          </div>
        )}
      </div>
    </Card>
  );
};

EmptyState.displayName = "EmptyState";

